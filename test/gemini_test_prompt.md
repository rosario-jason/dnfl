
### Can we update the calculations as follows:



### Required Input Data Points per Team
- Total Points (PF)
- Head-to-Head Win Percentage (H2H%)
- All-Play Win Percentage (All-Play%)
- Projected Rest of Season Starter Points (PROJ_STARTER)
- Projected Rest of Season Bench Points (PROJ_BENCH)
- Current Week of the Season (Integer from 1 to 12)

### Step 1: Calculate the Composite Projection Score
For each team, blend the starter and bench forward-looking projections using an 80/20 sub-allocation weight:
Composite Projection = (PROJ_STARTER * 0.80) + (PROJ_BENCH * 0.20)

### Step 2: Determine Dynamic Weekly Overarching Weights
Calculate the primary weights for the current week using a floor-adjusted linear decay across a 12-week regular season timeline. This gradually shifts the focus from projections to performance as the sample size grows:
- Performance Weight = 0.20 + (0.65 * (Current Week - 1) / 11)
- Projection Weight = 1.0 - Performance Weight

### Step 3: Sub-allocate the Performance Bucket Weights
Divide the calculated Performance Weight into three distinct historical metrics using fixed ratios:
- All-Play Weight = Performance Weight * 0.50
- Total Points Weight = Performance Weight * 0.30
- H2H Weight = Performance Weight * 0.20

### Step 4: Standardize Metrics via Population Z-Scores
For each of the 4 final metrics (Total Points, H2H%, All-Play%, and the Composite Projection Score):
1. Calculate the league-wide Mean (μ) and Population Standard Deviation (σ).
2. Calculate each team's individual Z-score to measure how many standard deviations they sit above or below the league average: 
   Z = (Team Metric Value - League Mean) / League Standard Deviation

### Step 5: Apply Linear Transformation (60–100 Scale per Metric)
To avoid rigid ceilings and prevent forcing an artificial 100 or 60 extreme every week, scale each raw Z-score individually. Center the distribution at a league average of 80, using a fixed dispersion factor of 6.5 to create a natural, organic range:
- Scaled All-Play Score = 80 + (Z_All-Play * 6.5)
- Scaled Total Points Score = 80 + (Z_TotalPoints * 6.5)
- Scaled H2H Score = 80 + (Z_H2H * 6.5)
- Scaled Projection Score = 80 + (Z_Projection * 6.5)

### Step 6: Aggregate the Final Power Score
Calculate each team's final Power Index by applying the dynamic weekly weights from Steps 2 and 3 directly to the individual pre-scaled component scores from Step 5:
Final Power Score = (Scaled All-Play Score * All-Play Weight) + 
                    (Scaled Total Points Score * Total Points Weight) + 
                    (Scaled H2H Score * H2H Weight) + 
                    (Scaled Projection Score * Projection Weight)

Rank all teams in descending order based on this Final Power Score.
