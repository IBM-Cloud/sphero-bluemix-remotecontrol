sphero-bluemix-remotecontrol
================================================================================

This [project](https://github.com/IBM-Bluemix/sphero-bluemix-remotecontrol) contains a web application that allows remote controlling a [Sphero](http://www.gosphero.com/sphero/) ball over the internet. Additionally a [Sphero chariot](http://store.gosphero.com/products/chariot) is used which carries an iOS device. The iOS device can take series of pictures which are displayed in the web app. With these capabilities the ball and iOS device can be steered without having to see the actual devices.

![alt text](https://raw.githubusercontent.com/IBM-Bluemix/sphero-bluemix-remotecontrol/master/images/webapp.png "Web App")

In order to run this application an iOS device is needed and the [Sphero Bluemix iOS app](https://github.com/IBM-Bluemix/sphero-bluemix-ios) needs to be installed and configured. Please follow the instructions in the iOS project how to set up the iOS app and how to register devices with the [IBM Internet of Things](https://console.ng.bluemix.net/?ace_base=true#/store/serviceOfferingGuid=8e3a9040-7ce8-4022-a36b-47f836d2b83e&fromCatalog=true) service in [IBM Bluemix](http://bluemix.net). Watch the [videos](http://heidloff.net/nh/home.nsf/article.xsp?id=13.04.2015120246NHEDSS.htm) to learn more.

Authors: Bryan Boyd (most code), Niklas Heidloff (minor tweaks)


Setup of the Node.js Application
================================================================================

The web application is a Node.js application which uses the [IBM Internet of Things](https://console.ng.bluemix.net/?ace_base=true#/store/serviceOfferingGuid=8e3a9040-7ce8-4022-a36b-47f836d2b83e&fromCatalog=true) service. After the setup you should have your own application deployed to Bluemix similar to this [example](https://raw.githubusercontent.com/IBM-Bluemix/sphero-bluemix-remotecontrol/master/images/bluemixapp.png).

1. Create a Bluemix Account. [Sign up](https://apps.admin.ibmcloud.com/manage/trial/bluemix.html) in Bluemix, or use an existing account. 

2. Download and install the [Cloud-foundry CLI](https://github.com/cloudfoundry/cli) tool.

3. In the Bluemix user interface create a new Node.js application and add the Internet of Things service to it. Copy the [credentials](https://raw.githubusercontent.com/IBM-Bluemix/sphero-bluemix-remotecontrol/master/images/iotcredentials.png).

4. Download the application and change to that directory. Run "npm install".

5. Modify the file [public/drive/js/main.js]((https://raw.githubusercontent.com/IBM-Bluemix/sphero-bluemix-remotecontrol/master/images/webappcredentials.png)). Replace the text in the screenshot with your org id, appKey and appToken from the previous step. Note that in a real production application you should not put the credentials in the JavaScript file.

6. Edit the manifest file and change the application name to the name that you chose in the third step above, e.g. ibm-chariot-nik.

7. Connect to Bluemix in the command line tool and invoke "cf push". After this you will be able to open the web app, e.g. http://ibm-chariot-nik.mybluemix.net.