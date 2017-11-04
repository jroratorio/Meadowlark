var Browser = require( 'zombie' );
var browser;

suite( 'Cross-Page Tests' , function() {

	setup( function() {
		browser = new Browser();
	});
	this.timeout( 25000 );

	test( 'requesting a group rate quote from the hood river tour page should populate the referrer field', function( done ) {
		var referrer = 'http://localhost:3000/tours/hood-river';
		browser.visit( referrer, function() {
			browser.clickLink( '.requestGroupRate' , function() {
				browser.assert.element( 'form input[name=referrer]' , referrer );
				done();
			});
		});
	});

	test( 'requesting a group rate from the oregon coast tour page should populate the referrer field', function( done ) {
		var referrer = 'http://localhost:3000/tours/oregon-coast';
		browser.visit( referrer, function() {
			browser.clickLink( '.requestGroupRate' , function() {
				browser.assert.element( 'form input[name=referrer]' , referrer );
				done();
			});
		});
	});

	test( 'visiting the "request group rate" page dirctly should result in an empty referrer field', function( done ) {
		browser.visit( 'http://localhost:3000/tours/request-group-rate', function() {
			browser.assert.element( 'form input[name=referrer]' , '' );
			done();
		});
	});
});