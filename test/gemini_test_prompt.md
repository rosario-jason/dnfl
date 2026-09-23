Does MFL have projections through the rest of the season for players, or just for next upcoming game? I need something that is looking out at whole season.

I believe we can use API for Fantasy Pros (with limited calls). They may truncate data as I have a free account. Can we try and see what data looks like to see if we can use?

See copy of documentation below:

Javascript:
const response = await fetch(
  "https://api.fantasypros.com/public/v2/json/nfl/2025/projections?position=RB&week=4",
  { headers: { "x-api-key": "YOUR_API_KEY" } }
);
const data = await response.json();
console.log(data.players);

**My API Key: opmFk3LieZ1XJv47E7tRDaXByPnhhcEJ9hLDK0Q0**

TEST:
https://api.fantasypros.com/public/v2/json/nfl/{season}/projections

Authorizations:
api_key
path Parameters
season
required
integer (Season) >= 2012
Example: 2024
A numerical season in the format YYYY

query Parameters
position
required
NFLPositions (string) or MLBPositions (string) or NBAPositions (string) or NHLPositions (string) or NCAAFPositions (string) (SPORTPositions)
filters	
string^(\d+)((?:\:\d+)+)?$
Example: filters=345:332:12
A comma delimited string of expert IDs filter rankings by

positions	
string (wordColon) ^(\w+)((?:\:\w+)+)?$
Colon delimited list of positions to filter response by

players	
string (digitColon) ^(\d+)((?:\:\d+)+)?$
Examples:
players=7354 - A single player
players=7354:6880 - Multiple players
Colon delimited list of FP player IDs to filter response by

week	
integer
Example: week=4
The week to request projections for use week = 0 for preseason projections.

ros	
boolean
Default: false
Example: ros=true
Return Rest of Season projections