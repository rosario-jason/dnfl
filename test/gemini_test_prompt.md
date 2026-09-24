#### Please review the comments below regarding issues with and/or requested updates for the new standings module. Complete a root cause analysis and provide your recommended solutions for each.

**Issues / Changes**
1) **Card-Title Format** The card-title is not the format as the standard card-title used for the Rankings and Exporter module. It does not span th full width of the card and has a top margin which pushes in down in the card.

2) **Inner container widths incorrect** The controls box and the table are narrower than the same elements in the Rankings and Exporter modules. This module should match the others.

3) **Legend** We should move the legend to it's own container in the same style as the legend in the Rankings module for the conference chart colors.

4) **Table header and division rows** The Division row, with the hide button should be above the table header row. the table header row should repeat for each division.

5) **Division Rows** We should use full {Conference}{space}{Division} names in the rows instead of just the division name. Change style so each word is Capitalized and not all uppercase.

6) **Points For and Points Against Styling** Let's try changing the styling of the PF and PA columns to use the dnfl-badge-green and dnfl-badge-red badges to match style used in other modules. For now I want to test this and see how it looks - I may want to revert back. As we did in other modules we should add module specific css to standardize the widths of these badges so they are all the same size and can fit X,XXX.XX. Confirm that we have formatting set to include thousands comma and two decimal places.

**Considerations**
- Be sure all fixes fit within overall architecture, utilize the global css architecture, and are simple, elegant, and scalable