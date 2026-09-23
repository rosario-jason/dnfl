A couple more minor issues and updates

#### Issues
**Issue A: Exporter Table in Test B is showing full width in mobile view - not scrolling in container**
On **Test A (Hybrid)** the table for csv is responsive and touch scrolls left to right to see hidden columns. On **Test B (Native MFL)** the table for csv is showing the full width and therefore everything is minimized in mobile responsive view. On both tables, output box for JSON and Markdown looks to be working.

**Issue B: Test B MFL Native Table Styling is still default styling**
In **Test B (Native MFL)** Mobile responsiveness was fixed for Native MFL, but all of the tables still have default styling - not the dnfl styling desired.

#### Update
**Mobile Responsive button names** Instead of removing text completely on mobile devices let's shorten button text to "Generate", "Copy", and "Download" as these should fit and will make more sense.