
#### Issues
**Issue A: Exporter Table in Test B width in mobile view is still making outer container stretch**
On **Test B (Native MFL)** the table for csv is still too wide - it does scroll, but it is pushing wrapper around it wider so that selectors, buttons, and any elements outside card are being minimized on screen

**Issue B: Test B MFL Native Table Styling still has some issues** The tables are now formatting with the correct row paddings background / hover colors. However, we have some tables within tables in native NFL, so both the background table and the inner table have coloring and hover states, which looks strange (for example with class "two_column_layout"). In addition, on some pages (e.g. Weekly Lineups Report O=06) The main table does not appear to be in a wrapper, so it is 100% width of screen and not in a visual card, while other tables seem to be in multiple wrappers, buth having shadow. We need to see how to make these look more natural and in line with out style. Some table headers (e.g. draft grid report) have white font on a white background, so are not visible.

#### Update
**Additional MFL Styling Updates** We need to update some additional elements so that pages look like our other reports. These include report navigation headers and selectors, pagetitle, etc.

