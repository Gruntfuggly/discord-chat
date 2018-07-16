const Discord = require( 'discord.js' );
const client = new Discord.Client();

var channels;

client.on( 'ready', () =>
{
    console.log( `Logged in as ${client.user.tag}!` );
    channels = client.channels;
    channels.map( function( channel )
    {
        if( channel.type === "text" )
        {
            console.log( channel.guild.name + "/" + channel.name + ":" + channel.lastMessageId );
            channel.fetchMessages( { limit: 10 } ).then( function( messages )
            {
                messages.map( function( message )
                {
                    console.log( "  " + message.author.username + ": " + message.content );
                } );
            } );
        }
    } );
} );

client.on( 'message', msg =>
{
    var log = client.logs_from( msg.channel, limit = 100 );
    console.log( JSON.stringify( msg ) );
    if( msg.content === 'ping' )
    {
        msg.reply( 'pong' );
    }
} );

client.login( '' );
