#!/usr/bin/env node
'use strict';

var regions = [process.env.AWS_REGION || 'us-east-1'];
var argv = require('yargs')
	.usage(
		`Checks various regions for a key alias.
Usage: $0 [regions] <key>`)
	.option('region', {
		describe: 'Additional regions to test.  Automatically includes AWS_REGION || "us-east-1"',
		default: regions
	})
	.demand(1)
	.help()
	.argv;

var aws = require('aws-sdk');

if (argv.region) {
	regions = regions.concat(argv.region);

	regions = regions.filter(function(region, index) {
			return regions.indexOf(region) === index
		});
}

var keyBuffer = new Buffer(argv._[0], 'base64');

checkKeyInRegion(regions[0], function (err, keyData) {
	if (err) {
		console.error(err);
		process.exit(1);
	} else {
		console.log(`Region: ${keyData.region}, Alias: ${keyData.alias || '<unknown>'}, Key ID: ${keyData.keyId}`);
		process.exit();
	}
});

function checkKeyInRegion(region, callback) {
	var client = new aws.KMS({region: region});
	var params = {
		CiphertextBlob: keyBuffer
	};

	client.decrypt(params, function (err, data) {
		if (err) {
			// may not have access, or may be wrong region
			// recurse to next one
			regions.shift();
			if (regions.length) {
				checkKeyInRegion(regions[0], callback)
			} else {
				callback(err)
			}
		} else {
			var keyId = data.KeyId;
			client.listAliases({}, function (err, data) {
				let alias = undefined;

				// if we error here, we may just not have rights to listAliases,
				// which isn't a real error, so just spit out the key ID
				if (!err) {
					let target = keyId.substring(keyId.indexOf('key/') + 4);
					let key = data.Aliases.filter(alias => alias.TargetKeyId === target);
					if (key.length) {
						alias = key[0].AliasName
					}
				}

				callback(null, {
					region: client.config.region,
					keyId: keyId,
					alias: alias
				})
			});
		}
	});
}

