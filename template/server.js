
const PATH = require("path");
const FS = require("fs");
const EXPRESS = require("express");
const SEND = require("send");
const HTTP = require("http");
const WS = require("ws");
const MORGAN = require("morgan");


//const DEV = process.env.DEV || false;


return require("org.pinf.genesis.lib/lib/main").main(function(options, callback) {

	var app = EXPRESS();

	app.use(MORGAN('combined'));

	// TODO: Load descriptor via PINF abstraction.
	var programDescriptor = require("./program.json");
/*
	if (DEV) {

		// TODO: Dynamically load plugins like the one below.

		const PINF = require("pinf-for-nodejs");

		// TODO: Also optionally enable dev sources if client request included
		//       a `devas` (Development Access Signature) hash proving that the
		//       client is allowed to make the given request.

		console.log("Mounting dev sources ...");

		if (
			programDescriptor.exports &&
			programDescriptor.exports.bundles
		) {
			for (var bundleUri in programDescriptor.exports.bundles) {

				if (typeof programDescriptor.exports.bundles[bundleUri] === "string") {
					programDescriptor.exports.bundles[bundleUri] = {
						path: programDescriptor.exports.bundles[bundleUri]
					};
				}

				if (programDescriptor.exports.bundles[bundleUri].source) {

					var sourceLocator = programDescriptor.exports.bundles[bundleUri].source;
					if (typeof sourceLocator === "string") {
						sourceLocator = {
							path: sourceLocator
						};
					}

					var bundleRoute = new RegExp("^\\/bundles\\/(" + bundleUri.replace(/\/g/, "\\/").replace(/\.js$/, ".+)$"));

					console.log("Mounting of '" + PATH.join(__dirname, sourceLocator.path) + "' to '" + bundleRoute + "'!");

					app.get(bundleRoute, PINF.hoist(PATH.join(__dirname, sourceLocator.path), options.$pinf.makeOptions({
						debug: true,
						verbose: true,
						PINF_RUNTIME: "",
						autoloadSourceChanges: true,
						bootProgramDescriptorOverlay: sourceLocator.overlay || null,
				        $pinf: options.$pinf
				    })));

				} else {
					console.log("Skipping mount of '" + bundleUri + "' as program source not declared!");
				}
			}
		}

		console.log("... mounting dev sources done!");
	}
*/
	var runtimeDescriptor = require(programDescriptor.boot.runtime);
	// TODO: Use JSON-LD to expand relevant properties. We cannot lookup by alias (key in `runtimeDescriptor`)
	//       as the alias cloud be anything. We need to lookup based on the `$context` uri as that will be
	//       predictable.
	var configId = "github.com/pinf-to/pinf-to-browser/0";
	var config = null;
	for (var alias in runtimeDescriptor) {
		if (runtimeDescriptor[alias].$context === configId) {
			config = runtimeDescriptor[alias];
			break;			
		}
	}
	if (!config) {
		return callback(new Error("No config found for '" + configId + "' in runtime descriptor '" + require.resolve(programDescriptor.boot.runtime) + "'"));
	}

	// Use default loader if bundles don't ship their own loader.
	if (!FS.existsSync(PATH.join(__dirname, "www/bundles/loader.js"))) {
		app.get(/^\/bundles\/(loader\.js)$/, function (req, res, next) {
			return SEND(req, req.params[0], {
				root: PATH.join(__dirname, "node_modules/pinf-loader-js")
			}).on("error", next).pipe(res);
		});
	}

	app.get(/^(\/.*)$/, function (req, res, next) {
		var path = req.params[0];
		if (path === "/") path = "/index.html";
		return SEND(req, path, {
			root: PATH.join(__dirname, "www")
		}).on("error", next).pipe(res);
	});


	var server = HTTP.createServer(app);
	server.listen(config.port, config.bind);


	var connections = [];
	var wss = new WS.Server({
		server: server
	});
	wss.on('connection', function (ws) {

		var index = "key:" + Object.keys(connections).length;

		connections.push(ws);

		ws.on('message', function (message) {
			console.log('received: %s', message);
		});

		ws.on('close', function () {
			console.log("Websocket closed.");
		});
	});

	function tiggerSourceHashChanged () {
		console.log("Source hash changed!");
		var cons = connections;
		connections = [];
		cons.forEach(function (ws) {
			ws.close();
		});
	}


	function monitorSourceHashFile () {
		if (
			!programDescriptor.config ||
			!programDescriptor.config.sourceHashFile
		) return;

		var previousHash = null;

		function checkFile (callback) {
			return FS.readFile(programDescriptor.config.sourceHashFile, "utf8", function (err, hash) {
				if (err) return callback(err);
				if (previousHash && hash !== previousHash) {
					tiggerSourceHashChanged();
				}
				previousHash = hash;
			});
		}

		setInterval(function () {
			checkFile(function (err) {
				if (err) {
					console.error("Error checking sourceHashFile '" + programDescriptor.config.sourceHashFile + "':", err.stack);
				}
			});
		}, 1000);
	}

	monitorSourceHashFile();


	// Wait for debug output from `PINF.hoist()` to finish.
	setTimeout(function() {
		console.log("Open browser to: http://" + config.bind + ":" + config.port + "/");
	}, 2 * 1000);

}, module);
