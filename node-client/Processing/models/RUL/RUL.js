/* Functions overview
getMeasurements -> Converts the measurements with timestamps in measurements with durations
getWorkingPoints -> Extracts the working points from an array of measurements
getLDDTable -> Calculates the LDD table given some working points
getLDDDamage -> Calculates the damage of a component given the LDD table
getComponentDamage -> Calculates the damage of a given component given several working points
getComponentsFromConfig -> Simply gets all the components in the config file
test -> Tests all the functions, not to be used in production
*/

/**
    * Converts the measurements with timestamps in measurements with durations
    * @param {Array} rawMeasurements the raw measurements in the format (torque, speed, timestamp) => (torque, speed, duration) => (torque, cycles)
    * @return {Array} the measurements in the format 
    */
const getMeasurements = rawMeasurements => {
  rawMeasurements.forEach((measure, i) => {
    // TODO: if the timestamp is not in seconds convert it to seconds
    // The measure duration is the next measure timestamp minus its own, the last measure has default duration 0
    measure.duration = (i != rawMeasurements.length - 1) ? rawMeasurements[i + 1].timestamp - measure.timestamp : 0;
  });
  // Calculate the cycles depending on the speed measurement unit
  rawMeasurements.forEach(measure => {
    if (measure.speedUnits == "1/s") {
      measure.cycles = measure.speed * measure.duration;
    } else if (measure.speedUnits == "rpm") {
      measure.cycles = measure.speed + measure.duration / 60;
    }
  });
  // Sort the array by increasing torque, usually the more cycles the less torque and viceversa
  return rawMeasurements.sort((a, b) => a.timestamp > b.timestamp);
};

/**
    * Extracts the working points from an array of measurements
    * @param {Array} measurements the measurements from the db
    * @param {Float} tMax the maximum allowed torque
    * @param {Int} numberOfClusters the number of cluster to be considered when dividing in intervals
    * @return {Array} the calculated working points
    */
const getWorkingPoints = (measurements, tMax, numberOfClusters) => {
  // First let's get the dimension of each interval
  const step = 2 * tMax / numberOfClusters;
  // Get all the intervals identifier (the lower integer of the interval)
  const intervals = Array.from(Array(numberOfClusters).keys(), x => - tMax + x * step);
  // Subdivide all the measurements in the correct interval
  return intervals.map(interval => {
    // Variable to store the total cycles for each interval
    var totalCyclesInInterval = 0;
    // Variable to store the number of times a measurement is in the interval but not the one before
    var timesInTheInterval = 0;
    // For each measurement if it is in the range than add to that range its cycles number
    measurements.forEach((m, i) => {
      // Check that it is in the interval
      if (m.torque >= interval && m.torque < interval + step) {
        // If it is there add the cycles
        totalCyclesInInterval += m.cycles;
        // If it is the first measure or the measure before is not in this interval increment timesInTheInterval
        if (i == 0 || !(measurements[i - 1].torque >= interval && measurements[i - 1].torque < interval + step)) {
          timesInTheInterval += 1;
        }
      }
    });
    /*
    interval: is the the lower integer of the interval
    cycles: is the total number of cycles spent in the working point
    times: is the number of times that the gearbox has been working in the working point
    */
    return ({ interval: interval, cycles: totalCyclesInInterval, times: timesInTheInterval });
  });
};

/**
    * Calculates the LDD table given some working points
    * @param {Array} workingPoints the calculated working points {interval: .., cycles: .., times: ..}
    * @return {Object} The LDD table
    */
const getLDDTable = workingPoints => {
  // Take the working points and sum the cycles of the negative and positive intervals, eg. i: 1, -i: 1 => i: 2
  var LDDtable = [];
  var j = workingPoints.length - 1;
  for (var i = 0; i < workingPoints.length / 2; i++) {
    // If there are cycles for that working point than calculate the LDD table
    if (workingPoints[i].cycles + workingPoints[j].cycles != 0) {
      LDDtable.push({ interval: workingPoints[j].interval, cycles: workingPoints[i].cycles + workingPoints[j].cycles })
    }
    j -= 1;
  }
  return LDDtable;
}

/**
    * Calculates the damage of a component given the LDD table
    * @param {Object} component the JSON config entry of the component
    * @param {Object} LDDTable The LDD table
    * @return {Int} The damage of the component from 0..1 
    */
const getLDDDamage = (component, LDDTable) => {
  const step = LDDTable[1].interval - LDDTable[0].interval;
  var componentDamageAllWp = []; // This variable stores the damage of the component for all the working points
  LDDTable.forEach(LDDrow => {
    var damageOfComponentForThisWorkingPoint = 0;
    //TODO: Here is made the assumption of taking the max torque of each interval
    const maxTorqueOfWorkingPoint = LDDrow.interval + step;
    const torqueWpComponent = maxTorqueOfWorkingPoint * component.Rt * component.r; // T_i,j
    var cyclesComponent = LDDrow.cycles * component.Rt; // n_i,j
    // Calculating the overalll stress of the component for the given working point
    const componentStress = torqueWpComponent * component.k; // S_i,j
    // Damage and stress limit checks 
    if (componentStress > component.Sa) { damageOfComponentForThisWorkingPoint = 1; } // Brake of the component
    if (componentStress < component.Sb) { cyclesComponent = 0; } // The stress is considered as negligible
    // Max number of cycles tolerable by the component at this working point
    const maxCyclesTolerable = component.Nb * Math.pow((component.Sb / componentStress), component.p);
    // Damage check
    if (cyclesComponent > maxCyclesTolerable) { damageOfComponentForThisWorkingPoint = 1; } // Brake of the component
    // If the damage is not being set to 1 then calculate it
    if (damageOfComponentForThisWorkingPoint != 1) { cyclesComponent / maxCyclesTolerable; }
    // Store the damage in the array
    componentDamageAllWp.push({ interval: LDDrow.interval, damage: damageOfComponentForThisWorkingPoint });
  });
  // Overall component damage is the sum of component damage for each working point or 1 if it is broken
  const overallComponentDamage = componentDamageAllWp.map(x => x.damage).reduce((tot, x) => Math.min(1, tot + x));
  return { component: component, damage: overallComponentDamage }; // Return the component and its damage
}

/**
    * Calculates the damage of a given component given several working points
    * @param {Object} component the object representation of the component JSON config entry
    * @param {Array} workingPoints the calculated working points {interval: .., cycles: .., times: ..}
    * @param {Object} The LDD table
    * @return {Float} the component damage in the range 0...1
    */
const getComponentDamage = (component, LDDTable) => {
  // Check the allowed algorithm for the component
  if (component.clusteringAlgorithmType == 'LDD') {
    return getLDDDamage(component, LDDTable);
  }
  // TODO: implement RFC algorithm

};

/**
    * Simply gets all the components in the config file
    * @param {Object} config the object representation of the JSON config 
    * @return {Array} List of all the components
    */
const getComponentsFromConfig = config => {
  var components = [];
  config.stages.forEach(st => {
    st.shafts.forEach(sh => {
      sh.components.forEach(c => {
        components.push(c);
      });
    });
  });
  return components;
}

/**
    * Tests all the functions, not to be used in production
    */
var test = () => {
  // The configurations may be multiple, one for each gearbox. They are catalog and data known before any measurement is made.
  const config = require('./configurations/gearbox_1.json');

  // The rawMeasurements variable represents the measurements taken from the db
  const rawMeasurements = [
    { torque: 10, torqueUnits: 'Nm', speed: 10, speedUnits: '1/s', timestamp: 0, timestampUnits: "s" },
    { torque: 20, torqueUnits: 'Nm', speed: 0, speedUnits: '1/s', timestamp: 1, timestampUnits: "s" },
    { torque: 20, torqueUnits: 'Nm', speed: 0, speedUnits: '1/s', timestamp: 2, timestampUnits: "s" },
    { torque: 30, torqueUnits: 'Nm', speed: 100, speedUnits: '1/s', timestamp: 3, timestampUnits: "s" },
    { torque: 90, torqueUnits: 'Nm', speed: 50, speedUnits: '1/s', timestamp: 4, timestampUnits: "s" },
    { torque: 90, torqueUnits: 'Nm', speed: 50, speedUnits: '1/s', timestamp: 5, timestampUnits: "s" },
    { torque: 20, torqueUnits: 'Nm', speed: 0, speedUnits: '1/s', timestamp: 6, timestampUnits: "s" },
    { torque: 90, torqueUnits: 'Nm', speed: 50, speedUnits: '1/s', timestamp: 7, timestampUnits: "s" },
  ];

  // Clean the measurements getting only the torque and cycles and ordering them by timestamp (oldest first)
  const measurements = getMeasurements(rawMeasurements).map(m => ({ torque: m.torque, cycles: m.cycles }));
  console.log('Measurements\n', measurements);

  // Create the working points intervals
  // TODO: working points should be indentified by the intervalMin and intervalMax, not only by interval
  const workingPoints = getWorkingPoints(measurements, config.tMax, config.numberOfClusters);
  console.log('Working points\n', workingPoints);

  // Get the components of the gearbox from the config file
  const components = getComponentsFromConfig(config);
  console.log('Components\n', components);

  // Get the LDD table if at least one component has LDD as algorithm
  const LDDTable = getLDDTable(workingPoints);
  console.log('LDD Table\n', LDDTable);

  // For each component get the damaging of it
  const componentsDamage = components.map(component => getComponentDamage(component, LDDTable));
  console.log('Components damage\n', componentsDamage);

  // The total damage is the maximum damage among the components
  const totalDamage = Math.max(...componentsDamage.map(component => component.damage));

  // The RUL of the gearbox is the nominal duration in hours x ( 1 minus the total damage )
  const RUL = config.nominalHoursDuration * (1 - totalDamage);
  console.log("Gearbox RUL", RUL);
}


// Run if the file is run directly from Node.js and not just imported
if (require.main === module) {
  test();
}
