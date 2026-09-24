#### Review the following notes and present your recommended appraoch for addressing.

**1. Chart Tooltip Optimization**
I agree with your approach with one update:
- Line 2: Conference & Division format as {Conference}{space}{Division} (e.g., Cameron Crazies South — no "Division: " prefix and no "-")
**2. Rank Badge Uniform Square Shape**
There is already a .dnfl-rank-badge class in dnfl-global.css v3_36. Let's update this style and make note in test.scss file of update/degredation of old style

**3. Change Column Badges Uniform Width**
I agree with module specific nested class approach

**4. Alternating Row Colors**
How does your recommended approach above impact our current styling in dnfl-global.css (see below). Please determine if we need to alter approach. 
   .dnfl-table tr:nth-child(even),
   .dnfl-table tr.dnfl-row-even,
   #dnfl_dataTable tr:nth-child(even),
   #dnfl_dataTable tr.dnfl-row-even {
      background-color: var(--dnfl-bg-alt);
   }

**Considerations**
- Be sure all fixes fit within overall architecture, utilize the global css architecture, and are simple, elegant, and scalable