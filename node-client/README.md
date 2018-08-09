# Bonfiglioli Subcloud Architecture

## DC - Device Connector

Sul prompt dei comandi
> node clientDC.js

Description

![alt text](https://docs.google.com/drawings/d/e/2PACX-1vSTmCNTaDG9r2Ino_DPz-kUvAsiAeHW5HFQ61j130s0_5MjB11Fyz-oVXYmWDMvkD51YfjkvGpLKuET/pub?w=1267&h=529)


## CC - Cloud Connector

Sul prompt dei comandi
> node clientCC.js

Description

![alt text](https://docs.google.com/drawings/d/e/2PACX-1vTwzFbAK49nMjgewkmBBpXerGZ4-Vy8E6dtOK0jV_XSbPof2XLC6sKkFDY4Ae7AEOMJZWERINFhtg2e/pub?w=1266&h=577)

## Troubleshooting

Per poter comunicare con lo smartcheck abbiamo fatto il seguente accrocchio:

        "wsdl": "http://10.1.154.14:10080/wsdl/smartcheck_status_201601.wsdl",
        "endpoint": "http://10.1.154.14:10080/smcstatus"

        C è un port forwarding sulla macchina 10.1.154.14
        CMD WIN->
        netsh interface portproxy show all
        netsh interface portproxy add v4tov4 listenport=10080 listenaddress=0.0.0.0 connectport=80 connectaddress=10.1.71.100 protocol=tcp
        netsh interface portproxy delete v4tov4 listenport=10080 listenaddress=0.0.0.0 protocol=tcp 


