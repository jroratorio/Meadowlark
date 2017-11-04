var fortune = require( '../lib/fortune.js' );

exports.home = function( req, res ) {
	res.render( 'home' );
};

exports.about = function( req, res ) {
	res.render( 'about' , {
		fortune: fortune.getFortune(),
		pageTestScript: '/qa/tests-about.js'
	} );
};

exports.newsletter = function( req, res ) {
	res.render( 'newsletter' , { csrf: res.locals._csrfToken } );
};

exports.headers = function( req,res ) {
	res.set( 'Content-Type', 'text/plain' );
	var s = '';
	for( var name in req.headers )
		s += name + ': ' + req.headers[name] + '\n';
	res.send(s);
};

exports.fail = function( req, res ) {
	throw new Error( 'Nope!' );
};

exports.epicFail = function( req, res ) {
	process.nextTick( function() {
		throw new Error( 'Kaboom!' );
	});
};

exports.newsletterSignup = function( req, res ) {
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
};

exports.process = function( req, res ) {
	if( req.xhr || req.accepts( 'json,html' ) === 'json' ) {
		// if there were an error, we would send { error: 'error description' }
                res.send( { success: true } );
	} else {
		// if there were an error, we would redirect to an error page
                res.redirect( 303, '/thank-you' );
	}
};