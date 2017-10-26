var express = require( 'express' );
var fortune = require( './lib/fortune.js' );
var formidable = require( 'formidable' );
var credentials = require( './credentials.js' );
var cartValidation = require( './lib/cartValidation.js' );
var nodemailer = require( 'nodemailer' );
var http = require( 'http' );
var fs = require( 'fs' );
var mongoose = require( 'mongoose' );
var Vacation = require( './models/vacation.js' );
var VacationInSeasonListener = require( './models/vacationInSeasonListener.js' );
var MongoSessionStore = require( 'connect-mongo' )( require( 'express-session' ) );

var sessionStore = new MongoSessionStore( { url: credentials.mongo.development.connectionString } );

var app = express();

var mailTransport = nodemailer.createTransport( {
	host: 'localhost',
	secureConnection: true,
	// use SSL
	port: 465,
	auth: {
		user: credentials.gmail.user,
		pass: credentials.gmail.password,
	}
});

switch( app.get( 'env' ) ) {
	case 'development':
		// compact, colorful dev logging
		app.use( require( 'morgan' )( 'dev' ) );
		break;
	case 'production':
		// module 'express-logger' supports daily log rotation
		app.use( require( 'express-logger' )( {
			path: __dirname + '/log/requests.log'
		}));
		break;
}

// set up handlebars view engine
var handlebars = require( 'express3-handlebars' ).create( {
			defaultLayout:'main',
			helpers: {
				section: function( name, options ) {
					if( !this._sections )
						this._sections = {};
					this._sections[name] = options.fn( this );
					return null;
				}
			}
		} );
app.engine( 'handlebars' , handlebars.engine );
app.set( 'view engine' , 'handlebars' );

app.set( 'port' , process.env.PORT || 3000 );

function getWeatherData() {
	return {
		locations:
				[
					{
						name: 'Portland',
						forecastUrl: 'http://www.wunderground.com/US/OR/Portland.html',
						iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
						weather: 'Overcast',
						temp: '54.1 F (12.3 C)',
					},
					{
						name: 'Bend',
						forecastUrl: 'http://www.wunderground.com/US/OR/Bend.html',
						iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
						weather: 'Partly Cloudy',
						temp: '55.0 F (12.8 C)',
					},
					{
						name: 'Manzanita',
						forecastUrl: 'http://www.wunderground.com/US/OR/Manzanita.html',
						iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
						weather: 'Light Rain',
						temp: '55.0 F (12.8 C)',
					},
				],
	};
}

var dataDir = __dirname + '/data';
var vacationPhotoDir = dataDir + '/vacation-photo';
fs.existsSync( dataDir ) || fs.mkdirSync( dataDir );
fs.existsSync( vacationPhotoDir ) || fs.mkdirSync( vacationPhotoDir );

function saveContestEntry( contestName, email, year, month, photoPath ) {
	// TODO...this will come later
}

var opts = {
	server: {
		socketOptions: { keepAlive: 1 }
	}
};
switch( app.get( 'env' ) ) {
	case 'development':
		mongoose.connect( credentials.mongo.development.connectionString, opts );
		break;
	case 'production':
		mongoose.connect( credentials.mongo.production.connectionString, opts );
		break;
	default:
		throw new Error( 'Unknown execution environment: ' + app.get( 'env' ) );
}

Vacation.find( function( err, vacations ) {
	if( vacations.length )
		return;
	new Vacation({
		name: 'Hood River Day Trip',
		slug: 'hood-river-day-trip',
		category: 'Day Trip',
		sku: 'HR199',
		description: 'Spend a day sailing on the Columbia and ' +
		'enjoying craft beers in Hood River!',
		priceInCents: 9995,
		tags: ['day trip', 'hood river', 'sailing', 'windsurfing', 'breweries'],
		inSeason: true,
		maximumGuests: 16,
		available: true,
		packagesSold: 0,
	}).save();

	new Vacation({
		name: 'Oregon Coast Getaway',
		slug: 'oregon-coast-getaway',
		category: 'Weekend Getaway',
		sku: 'OC39',
		description: 'Enjoy the ocean air and quaint coastal towns!',
		priceInCents: 269995,
		tags: ['weekend getaway', 'oregon coast', 'beachcombing'],
		inSeason: false,
		maximumGuests: 8,
		available: true,
		packagesSold: 0,
	}).save();

	new Vacation({
		name: 'Rock Climbing in Bend',
		slug: 'rock-climbing-in-bend',
		category: 'Adventure',
		sku: 'B99',
		description: 'Experience the thrill of climbing in the high desert.',
		priceInCents: 289995,
		tags: ['weekend getaway', 'bend', 'high desert', 'rock climbing'],
		inSeason: true,
		requiresWaiver: true,
		maximumGuests: 4,
		available: false,
		packagesSold: 0,
		notes: 'The tour guide is currently recovering from a skiing accident.',
	}).save();
});

//middleware stack
app.use( function( req, res, next ) {
	// create a domain for this request
	var domain = require( 'domain' ).create();
	// handle errors on this domain
	domain.on( 'error', function( err ) {
		console.error( 'DOMAIN ERROR CAUGHT\n', err.stack );
		try {
			// failsafe shutdown in 5 seconds
			setTimeout( function() {
				console.error( 'Failsafe shutdown.' );
				process.exit(1);
			}, 5000);

			// disconnect from the cluster
			var worker = require( 'cluster' ).worker;
			if( worker )
				worker.disconnect();
			
			// stop taking new requests
			server.close();

			try {
				// attempt to use Express error route
				next( err );
			} catch( er ) {
				// if Express error route failed, try
				// plain Node response
				console.error( 'Express error mechanism failed.\n', er.stack );
				res.statusCode = 500;
				res.setHeader( 'content-type', 'text/plain' );
				res.end( 'Server error.' );
			}
		} catch( er ) {
			console.error( 'Unable to send 500 response.\n', er.stack );
		}
	});

	// add the request and response objects to the domain
	domain.add( req );
	domain.add( res );
	// execute the rest of the request chain in the domain
	domain.run( next );
});

app.use( express.static( __dirname + '/public' ) );
app.use(require( 'body-parser' )());
app.use(require( 'cookie-parser' )( credentials.cookieSecret ));
app.use(require('express-session')( { store: sessionStore } ) );

app.use( function( req, res, next ) {
	res.locals.showTests = app.get( 'env' ) !== 'production' && req.query.test === '1';
	next();
});

app.use(function( req, res, next ) {
	if( ! res.locals.partials )
		res.locals.partials = {};
	res.locals.partials.weather = getWeatherData();
	next();
});

app.use(require('./lib/tourRequiresWaiver.js'));
app.use( cartValidation.checkWaivers );
app.use( cartValidation.checkGuestCounts );

app.use( function( req, res, next ) {
	var cluster = require( 'cluster' );
	if( cluster.isWorker )
		console.log( 'Worker %d received request', cluster.worker.id );
	next();
});

app.use(function(req, res, next){
	// if there's a flash message, transfer
	// it to the context, then clear it
	if ( req.session.flash ) {
		res.locals.flash = req.session.flash;
		delete req.session.flash;
	}
	next();
});


//routes
app.get( '/' , function( req, res ) {
	// res.cookie( 'monster', 'nom nom' );
	// res.cookie( 'signed_monster', 'nom nom', { signed: true } );
	res.render( 'home' );
});

app.get( '/about' , function( req, res ) {
	res.render( 'about' , {
		fortune: fortune.getFortune(),
		pageTestScript: '/qa/tests-about.js'
	} );
});

app.get( '/tours/hood-river' , function( req, res ) {
	res.render( 'tours/hood-river' );
});

app.get( '/tours/oregon-coast' , function( req, res ) {
	res.render( 'tours/oregon-coast' );
});

app.get( '/tours/request-group-rate' , function( req, res ) {
	res.render( 'tours/request-group-rate' );
});

app.get( '/newsletter' , function( req, res ) {
	// we will learn about CSRF later...for now, we just
	// provide a dummy value
	res.render( 'newsletter' , { csrf: 'CSRF token goes here' } );
});

app.get( '/headers' , function( req,res ) {
	res.set( 'Content-Type', 'text/plain' );
	var s = '';
	for( var name in req.headers )
		s += name + ': ' + req.headers[name] + '\n';
	res.send(s);
});

app.get( '/nursery-rhyme', function( req, res ) {
	res.render( 'nursery-rhyme' );
});

app.get( '/data/nursery-rhyme', function( req, res ) {
	res.json({
		animal: 'squirrel',
		bodyPart: 'tail',
		adjective: 'bushy',
		noun: 'heck',
	});
});

app.get( '/contest/vacation-photo', function( req, res ) {
	var now = new Date();
	res.render( 'contest/vacation-photo', {
		year: now.getFullYear(),
		month: now.getMonth()
	});
});

app.get( '/fail', function( req, res ) {
	throw new Error( 'Nope!' );
});

app.get( '/epic-fail', function( req, res ) {
	process.nextTick( function() {
		throw new Error( 'Kaboom!' );
	});
});

// app.get( '/vacations', function( req, res ) {
// 	Vacation.find( { available: true }, function( err, vacations ) {
// 		var context = {
// 			vacations: vacations.map( function( vacation ) {
// 				return {
// 					sku: vacation.sku,
// 					name: vacation.name,
// 					description: vacation.description,
// 					price: vacation.getDisplayPrice(),
// 					inSeason: vacation.inSeason,
// 				}
// 			})
// 		};
// 		res.render( 'vacations', context );
// 	});
// });

app.get( '/notify-me-when-in-season', function( req, res ) {
	res.render( 'notify-me-when-in-season', { sku: req.query.sku } );
});

app.get( '/set-currency/:currency', function( req, res ) {
	req.session.currency = req.params.currency;
	return res.redirect( 303, '/vacations' );
});

function convertFromUSD( value, currency ) {
	switch( currency ) {
		case 'USD': return value * 1;
		case 'GBP': return value * 0.6;
		case 'BTC': return value * 0.0023707918444761;
		default: return NaN;
	}
}

app.get( '/vacations', function( req, res ) {
	Vacation.find( { available: true }, function( err, vacations ) {
		var currency = req.session.currency || 'USD';
		var context = {
			currency: currency,
			vacations: vacations.map( function( vacation ) {
				return {
					sku: vacation.sku,
					name: vacation.name,
					description: vacation.description,
					inSeason: vacation.inSeason,
					price: convertFromUSD( vacation.priceInCents/100, currency ),
					qty: vacation.qty,
				}
			})
		};
		switch( currency ) {
			case 'USD':
				context.currencyUSD = 'selected';
				break;
			case 'GBP':
				context.currencyGBP = 'selected';
				break;
			case 'BTC':
				context.currencyBTC = 'selected';
				break;
		}
		res.render( 'vacations', context );
	});
});

// app.post( '/process' , function( req, res ) {
// 	console.log( 'Form (from querystring): ' + req.query.form );
// 	console.log( 'CSRF token (from hidden form field): ' + req.body._csrf );
// 	console.log( 'Name (from visible form field): ' + req.body.name );
// 	console.log( 'Email (from visible form field): ' + req.body.email );
// 	res.redirect( 303, '/thank-you' );
// });

app.post( '/process' , function( req, res ) {
	if( req.xhr || req.accepts( 'json,html' ) === 'json' ) {
		// if there were an error, we would send { error: 'error description' }
		res.send( { success: true } );
	} else {
		// if there were an error, we would redirect to an error page
		res.redirect( 303, '/thank-you' );
	}
});

// app.post( '/contest/vacation-photo/:year/:month', function( req, res ) {
// 	var form = new formidable.IncomingForm();
// 	form.parse( req, function( err, fields, files ) {
// 		if( err )
// 			return res.redirect( 303, '/error' );
// 		console.log( 'received fields:' );
// 		console.log( fields );
// 		console.log( 'received files:' );
// 		console.log( files );
// 		res.redirect( 303, '/thank-you' );
// 	});
// });

app.post( '/contest/vacation-photo/:year/:month', function( req, res ) {
	var form = new formidable.IncomingForm();
	form.parse( req, function( err, fields, files ) {
		if( err )
			return res.redirect( 303, '/error' );
		if( err ) {
			res.session.flash = {
				type: 'danger',
				intro: 'Oops!',
				message: 'There was an error processing your submission. Pelase try again.',
			};
			return res.redirect( 303, '/contest/vacation-photo' );
		}
		var photo = files.photo;
		var dir = vacationPhotoDir + '/' + Date.now();
		var path = dir + '/' + photo.name;
		fs.mkdirSync( dir );
		fs.renameSync( photo.path, dir + '/' + photo.name );
		saveContestEntry( 'vacation-photo', fields.email, req.params.year, req.params.month, path );
		req.session.flash = {
			type: 'success',
			intro: 'Good luck!',
			message: 'You have been entered into the contest.',
		};
		return res.redirect(303, '/contest/vacation-photo/entries');
	});
});

app.post( '/newsletter', function( req, res ) {
	var name = req.body.name || '', email = req.body.email || '';
	// input validation
	if( !email.match( VALID_EMAIL_REGEX ) ) {
		if( req.xhr )
			return res.json( { error: 'Invalid name email address.' } );
		req.session.flash = {
			type: 'danger',
			intro: 'Validation error!',
			message: 'The email address you entered was not valid.',
		};
		return res.redirect( 303, '/newsletter/archive' );
	}
	new NewsletterSignup( { name: name, email: email } ).save( function( err ) {
		if( err ) {
			if( req.xhr )
				return res.json( { error: 'Database error.' } );
			req.session.flash = {
				type: 'danger',
				intro: 'Database error!',
				message: 'There was a database error; please try again later.',
			}
			return res.redirect( 303, '/newsletter/archive' );
		}
		if( req.xhr )
			return res.json( { success: true } );
		req.session.flash = {
			type: 'success',
			intro: 'Thank you!',
			message: 'You have now been signed up for the newsletter.',
		};
		return res.redirect( 303, '/newsletter/archive' );
	});
});

app.post( '/notify-me-when-in-season', function( req, res ) {
	VacationInSeasonListener.update(
		{ email: req.body.email },
		{ $push: { skus: req.body.sku } },
		{ upsert: true },
		function( err ) {
			if( err ) {
				console.error( err.stack );
				req.session.flash = {
					type: 'danger',
					intro: 'Ooops!',
					message: 'There was an error processing your request.',
				};
			return res.redirect( 303, '/vacations' );
			}
			req.session.flash = {
				type: 'success',
				intro: 'Thank you!',
				message: 'You will be notified when this vacation is in season.',
			};
			return res.redirect( 303, '/vacations' );
		}
	);
});

// 404 catch all handler
app.use( function( req, res ){
	res.status( 404 );
	res.render( '404' );
});

// custom 500 page
app.use( function( err, req, res, next ) {
	console.error( err.stack );
	res.status( 500 ).render( '500' );
});

// app.listen( app.get( 'port' ), function() {
// 	console.log( 'Express started on http://localhost:' + app.get( 'port' ) + '; press Ctrl-C to terminate.' );
// });

// http.createServer( app ).listen( app.get( 'port' ), function() {
// 	console.log( 'Express started in ' + app.get( 'env' ) + ' mode on http://localhost:' + app.get( 'port' ) + '; press Ctrl-C to terminate.' );
// });

function startServer() {
	http.createServer( app ).listen( app.get( 'port' ), function() {
		console.log( 'Express started in ' + app.get( 'env' ) + ' mode on http://localhost:' + app.get( 'port' ) + '; press Ctrl-C to terminate.' );
	});
}

if( require.main === module ) {
	// application run directly; start app server
	startServer();
} else {
	// application imported as a module via "require": export function
	// to create server
	module.exports = startServer;
}