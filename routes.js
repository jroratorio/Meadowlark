var main = require( './handlers/main.js' );
var tours = require( './handlers/tours.js' );
var rhyme = require( './handlers/nursery-rhyme.js' );
var vacation = require( './handlers/vacation.js' );
var attractionAPI = require( './handlers/attractionAPI.js' )

module.exports = function( app ) {
	app.get( '/', main.home );
	app.get( '/about', main.about );
	app.get( '/tours/hood-river' , tours.hoodRiver );
	app.get( '/tours/oregon-coast' , tours.oregonCoast );
	app.get( '/tours/request-group-rate' , tours.requestGroupRate );
	app.get( '/newsletter' , main.newsletter );
        app.get( '/headers' , main.headers );
	app.get( '/nursery-rhyme', rhyme.nurseryRhyme);
	app.get( '/data/nursery-rhyme', rhyme.dataNurseryRhyme );
	app.get( '/contest/vacation-photo', vacation.contestVacationPhoto );
	app.get( '/notify-me-when-in-season', vacation.notifyMeWhenInSeason );
	app.get( '/vacations', vacation.vacations );

	app.post( '/contest/vacation-photo/:year/:month', vacation.contestVacationPhotoYearMonth );
	app.post( '/notify-me-when-in-season', vacation.notifyMeWhenInSeasonListener );
	app.post( '/newsletter', main.newsletterSignup );
	app.post( '/process' , main.process );

	app.get( '/api/attractions', attractionAPI.getAttraction );
	app.get( '/api/attraction/:id', attractionAPI.getAttractionByID );
	app.post( '/api/attraction', attractionAPI.postAttraction );
};