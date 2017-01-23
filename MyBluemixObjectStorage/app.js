//------------------------------------------------------------------------------
// node.js application for Bluemix Object Storage
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

// cfenv provides access to your Cloud Foundry environment
var cfenv = require('cfenv');

//declare this web application's base URL
var appURL = 'https://mybluemixobjectstorage.eu-gb.mybluemix.net';

// and, cheekily, introduce the capability to sleep ...
var sleep = require('sleep');

// now get the environment variables specified against this instance
var appEnv = cfenv.getAppEnv();
var CONTAINER = process.env.CONTAINER;
var MAX_FILESIZE = parseInt(process.env.MAX_FILESIZE);
//console.log('Default Container : '+ CONTAINER);
//console.log('Maximum Filesize : '+ MAX_FILESIZE);

//Retrieve the environment variables provided by Bluemix
var appInfo = JSON.parse(process.env.VCAP_APPLICATION || "{}");
var serviceInfo = JSON.parse(process.env.VCAP_SERVICES || '{}');

// create the Bluemix Object Storage credentials variable
var pkgcloud = require('pkgcloud');
var BMXOS_CONFIG = {
    provider: 'openstack',
    useServiceCatalog: true,
    useInternal: false,
    keystoneAuthVersion: 'v3',
    authUrl: serviceInfo['Object-Storage'][0]['credentials']['auth_url'],
    tenantId: serviceInfo['Object-Storage'][0]['credentials']['projectId'],  //projectId from credentials
    domainId: serviceInfo['Object-Storage'][0]['credentials']['domainId'],
    username: serviceInfo['Object-Storage'][0]['credentials']['username'],
    password: serviceInfo['Object-Storage'][0]['credentials']['password'],
    region: serviceInfo['Object-Storage'][0]['credentials']['region']   //dallas or london region
};

//authenticate the client against the Bluemix Object Store
var BMXOS_CLIENT = pkgcloud.storage.createClient(BMXOS_CONFIG);
BMXOS_CLIENT.auth(function(err) {
    if (err) {
    	console.log('Bluemix Object Storage Client Authentication ' + err);
    }
    else {
        console.log('Bluemix Object Storage Client Authentication OK');
    }
});

// introduce multer so that it can handle multipart POSTs
var multer  = require('multer');

// introduce the bridge to Bluemix Object Storage (as a multer storage mechanism)
var pkgcloudStorage = require('multer-storage-pkgcloud');

// introduce the multer to Bluemix Object Store mechanism
var BMXOS_STORAGE = pkgcloudStorage({
	  client: BMXOS_CLIENT,
	  destination: function (req, file, cb) {
	    cb(null, {
	      container: CONTAINER,
	      remote: file.originalname
	    });
	  }
	});

// use multer middleware
var BMXOS_UPLOAD = multer({
	storage: BMXOS_STORAGE,
	limits: { fileSize: MAX_FILESIZE }
});

// create a new express server
var app = express();

// set up static routes and rendering engine
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/public');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

// set up route processing
// first deal with the top level route
app.get('/', function(req, res) {
    //console.log('GET Request on /');
    BMXOS_CLIENT.getFiles(CONTAINER, function (err, files) {
		res.render('main.ejs', { containerFiles: files, appURL: appURL});
	});
});

// deal with STORE
app.post('/store',BMXOS_UPLOAD.single('file-to-upload'), function (req, res) {
	//console.log('POST request on /store');
	//sleep.sleep(10); 	//sleep for a few seconds
	res.redirect('/');
});

// deal with DOWNLOAD
app.get('/download/:filetodownload', function (req, res) {
	//console.log('GET request to /download file : '+req.params.filetodownload);
	BMXOS_CLIENT.download({
	    container: CONTAINER,
	    remote: req.params.filetodownload
	  }).pipe(res);
});

// deal with DELETE
app.get('/delete/:filetodelete', function (req, res) {
	//console.log('GET request to /delete file : '+req.params.filetodelete);
	BMXOS_CLIENT.removeFile(CONTAINER, req.params.filetodelete, function (err) {
		if (err) {
			// An error occurred when deleting
			console.log('Error when deleting file' + err);
			return
		}
	});
	//sleep.sleep(10); 	//sleep for a few seconds
	res.redirect('/');
});

// put some error handling in - for good measure
app.use(function(err, req, res, next) {
	res.send('Error : ' + err );
});

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
//
// Utility functions
