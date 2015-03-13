
const PATH = require("path");
const FS = require("fs");
const PINF = require("pinf-for-nodejs");
const EXPRESS = require("express");
const SEND = require("send");
const HTTP = require("http");
const WS = require("ws");
const MORGAN = require("morgan");


const PORT = process.env.PORT || 8080;
const DEV = process.env.DEV || false;


return PINF.main(function(options, callback) {

	var app = EXPRESS();

	app.use(MORGAN('combined'));

	if (DEV) {
		// TODO: Also optionally enable dev sources if client request included
		//       a `devas` (Development Access Signature) hash proving that the
		//       client is allowed to make the given request.

		console.log("Mounting dev sources ...");

		// TODO: Load descriptor via PINF abstraction.
		var programDescriptor = require("./program.json");

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

	// Use default loader if bundles don't ship their own loader.
	if (!FS.existsSync(PATH.join(__dirname, "www/bundles/loader.js"))) {
		app.get(/^\/bundles\/(loader\.js)$/, function (req, res, next) {
			return SEND(req, req.params[0], {
				root: PATH.join(__dirname, "node_modules/pinf-for-nodejs/node_modules/pinf-loader-js")
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
	server.listen(PORT);


	var wss = new WS.Server({
		server: server
	});
	wss.on('connection', function (ws) {

console.log("websocket stated!");

		ws.on('message', function (message) {
			console.log('received: %s', message);
		});

		ws.on('close', function () {
			console.log("Websocket closed.");
		});
	});


	// Wait for debug output from `PINF.hoist()` to finish.
	setTimeout(function() {
		console.log("Open browser to: http://localhost:" + PORT + "/");
	}, 2 * 1000);

}, module);
