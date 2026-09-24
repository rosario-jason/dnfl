
### Can we update the calculations as follows:

A few CSS Notes. 

**Button Styling**
1) The buttons in a pc brwoser (I am using chrome on a mac) do not have modern, clean styling with blue text and simple border and no shadow. The buttons look great on my mobile device. Why are they different?
2) We should fix these  and update the global styles for future use. Let's update _test_v_xx.scss to fix and add a comment in _test.scss of any global styles that need to be deprecated or removed when we clean up the final v4 CSS. 

**Nested Container Issues**
1) The table inside the card for Rankings and the table / code boxes in Exporter now have a drop shadow and doe not have clean rounded corners. Also there are some background issues behind the code boxes where I can see white background "peeking" out around the edges of the corners. These were looking better in the last version - please review changes in css / code to see where this needs to be fixed.

**Rankings Table**
1) The Commentary Colums is very wide, while the Franchise column is squished. Can we adjust so that the Franchise column is wider where possible and only wraps on small screens?
2) The Power Ranking is using the blue badge, not the blue pill formatting style. Please use same style as record in standings table.
3) Rename "Commentary" column to "Comments"
4) Center the Comment Button and Comments Header in the column
5) The franchise name links in Rankings Table are not working - they should link to franchise pages

