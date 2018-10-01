var messages = {};

function addMessage( id, message, timeOfMessage )
{
    if( messages[ id ] === undefined )
    {
        messages[ id ] = [];
    }

    messages[ id ].push( { text: message, timeOfMessage: timeOfMessage, read: false } );
}

function chatRead( id, time )
{
    if( messages[ id ] )
    {
        messages[ id ].foreach( function( message )
        {
            message.read = timeOfMessage < time;
        } );
    }
}

function getReadMessages( id )
{
    if( messages[ id ] )
    {
        return messages[ id ].filter( function( message )
        {
            return message.read === true;
        } );
    }
    return [];
}

function getUnreadMessages( id )
{
    if( messages[ id ] )
    {
        return messages[ id ].filter( function( message )
        {
            return message.read === false;
        } );
    }
    return [];
}

module.exports.addMessage = addMessage;
module.exports.chatRead = chatRead;
module.exports.getReadMessages = getReadMessages;
module.exports.getUnreadMessages = getUnreadMessages;
