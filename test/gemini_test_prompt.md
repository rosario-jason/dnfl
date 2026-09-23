A couple more minor issues and updates

### Issues
**Issue A: Title**
On Test A, title icon is blue, text is midnight. On Test B both title icon and text are midnight. 

**Issue B: Loading font**
The text for loading / success / error is not dnfl-text-muted. A couple changes. 

### Updates
**1) Title** 
Change title to **DNFL Data Exporter**

 **2) Selector values** 
Change selector list to this:                     
    <option value="standings">1. League Standings</option>
    <option value="rosters">2. Franchise Rosters</option>
    <option value="matchups">3. Weekly Matchups</option>
    <option value="weeklyDetails">4. Weekly Lineups</option>
    <option value="powerRankings">5. Power Rankings Calc</option>

 **3) Data Refresh / Results Hiding** 
Add functionality so that when the user makes a change in a selector the data from the last export is hidden / the form is reset to ask user to "*Select report options above and click Generate.*"                    