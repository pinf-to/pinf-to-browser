
require("to.pinf.lib/lib/run").for(module, function (API, callback) {

	return API.getPrograms(function (err, programs) {
		if (err) return callback(err);

		var waitfor = API.WAITFOR.serial(callback);
		
		for (var programDescriptorPath in programs) {
			waitfor(programDescriptorPath, function (programDescriptorPath, done) {

				try {

					programDescriptor = programs[programDescriptorPath];

					API.ASSERT.equal(typeof programDescriptor.combined.name, "string", "name' must be set in '" + programDescriptorPath + "'");

					var programName = programDescriptor.combined.name.toLowerCase();

					console.log("Run program (" + programName + "):", programDescriptorPath);

					var config = API.getConfigFrom(programDescriptor.combined, "github.com/pinf-to/pinf-to-browser/0");

					var pubPath = API.PATH.join(programDescriptorPath, "../.pub");

					var templatePath = API.PATH.join(__dirname, "../template");
					var templateDescriptorPath = API.PATH.join(templatePath, "package.json");
					var templateDescriptor = API.FS.readJsonSync(templateDescriptorPath);

					function runServer (callback) {

						console.log("Starting server ...");

						API.ASSERT.equal(typeof process.env.PORT, "string", "process.env.PORT' must be set");

						var commands = [];

						// TODO: Use pinf-it-package-insight or derivative to detect if program is ready to run.
						// TODO: Start PINF program instead of calling npm directly here. i.e. The bundled program should
						//       be wrapped in a pinf-to-pinf-program wrapper/bundle/host/runtime which embeds npm or finds
						//       it in the environment.
						if (!API.FS.existsSync(API.PATH.join(pubPath, "node_modules"))) {
							commands.push('npm install --production --unsafe-perm');
						}

						commands.push('node server.js');

						return API.runCommands(commands, {
							cwd: pubPath
						}, function (err, response) {
							if (err) {
								return callback(err);
							}

							return callback(null);
						});
					}

					return runServer(done);
					
				} catch (err) {
					return done(err);
				}
			});
		}

		return waitfor();
	});
});
