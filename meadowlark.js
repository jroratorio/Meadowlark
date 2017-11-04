var express = require( 'express' );
var credentials = require( './credentials.js' );
var cartValidation = require( './lib/cartValidation.js' );
var nodemailer = require( 'nodemailer' );
var https = require( 'https' );
var http = require( 'http' );
var fs = require( 'fs' );
var mongoose = require( 'mongoose' );
var Vacation = require( './models/vacation.js' );
var MongoSessionStore = require( 'connect-mongo' )( require( 'express-session' ) );

// setting up session using Mongo Session
var sessionStore = new MongoSessionStore( { url: credentials.mongo.development.connectionString } );

var app = express(); //setting up express app

app.set( 'port' , process.env.PORT || 3000 ); //setting port for the express app

// setting up mail transport using nodemailer
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

// setting up logging for development and production
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
		},
		static: function( name ) {
			return require( './lib/static.js' ).map( name );
		}
	}
});
app.engine( 'handlebars' , handlebars.engine );
app.set( 'view engine' , 'handlebars' );

function getWeatherData() {
	return {
		locations:
				[
					{
						name: 'Portland',
						forecastUrl: 'https://www.wunderground.com/weather/us/or/portland',
						iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
						weather: 'Overcast',
						temp: '54.1 F (12.3 C)',
					},
					{
						name: 'Bend',
						forecastUrl: 'https://www.wunderground.com/weather/us/or/bend',
						iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
						weather: 'Partly Cloudy',
						temp: '55.0 F (12.8 C)',
					},
					{
						name: 'Manzanita',
						forecastUrl: 'https://www.wunderground.com/weather/us/or/manzanita',
						iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
						weather: 'Light Rain',
						temp: '55.0 F (12.8 C)',
					},
				],
	};
}

// setting up MongoDB for contests
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
	if( vacations.length ) //if something already exists
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

//setting up Domain handler
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

app.use( '/api', require( 'cors' )() ); // for rest api
app.use( express.static( __dirname + '/public' ) ); // middleware to serve static content
app.use( require( 'body-parser' )() ); // middleware to parse request body
app.use( require( 'cookie-parser' )( credentials.cookieSecret )); // middleware to parse cookies
app.use( require('express-session')( { store: sessionStore } ) ); // middleware to maintain express session

app.use( require( 'csurf' )() );
app.use( function( req, res, next ) {
	res.locals._csrfToken = req.csrfToken();
        next();
});

var auth = require( './lib/auth.js' )( app, {
	providers: credentials.authProviders,
	successRedirect: '/account',
	failureRedirect: '/unauthorized',
});
// auth.init() links in Passport middleware:
auth.init();
// now we can specify our auth routes:
auth.registerRoutes();

// middleware for set page test result
app.use( function( req, res, next ) {
	res.locals.showTests = app.get( 'env' ) !== 'production' && req.query.test === '1';
	next();
});

app.use( function( req, res, next ) {
	if( ! res.locals.partials )
		res.locals.partials = {};
	res.locals.partials.weather = getWeatherData();
	next();
});

app.use( require('./lib/tourRequiresWaiver.js'));
app.use( cartValidation.checkWaivers );
app.use( cartValidation.checkGuestCounts );

app.use( function( req, res, next ) {
	var cluster = require( 'cluster' );
	if( cluster.isWorker )
		console.log( 'Worker %d received request', cluster.worker.id );
	next();
});

app.use( function(req, res, next){
	// if there's a flash message, transfer
	// it to the context, then clear it
	if ( req.session.flash ) {
		res.locals.flash = req.session.flash;
		delete req.session.flash;
	}
	next();
});

//routes
require( './routes.js' )( app ); //includes all the woutes, including the api routes

app.get( '/set-currency/:currency', function( req, res ) {
	req.session.currency = req.params.currency;
	return res.redirect( 303, '/vacations' );
});

app.get( '/account', function( req, res ) {
	if( !req.session.passport.user )
		return res.redirect( 303, '/unauthorized' );
	res.render( 'account' );
});

// 404 catch all handler
app.use( function( req, res ){
	res.status( 404 ).render( '404' );
});

// custom 500 page
app.use( function( err, req, res, next ) {
	console.error( err.stack );
	res.status( 500 ).render( '500' );
});

//setting up https
var options = {
	key: fs.readFileSync(__dirname + '/ssl/meadowlark.pem'),
	cert: fs.readFileSync(__dirname + '/ssl/meadowlark.crt'),
};

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