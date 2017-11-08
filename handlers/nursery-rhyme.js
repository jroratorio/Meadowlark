exports.nurseryRhyme = function( req, res ) {
    res.render( 'nursery-rhyme' );
};

exports.dataNurseryRhyme = function( req, res ) {
    res.json({
	animal: 'squirrel',
	bodyPart: 'tail',
	adjective: 'bushy',
	noun: 'heck',
    });
};