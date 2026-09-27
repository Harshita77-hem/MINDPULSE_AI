# MindPulse AI — Plain HTML/CSS/JS build

The same Mental Health Score Predictor frontend as the React version, with
no framework and no build step — just three files: `index.html`,
`styles.css`, `script.js`.

## Requirements

- The FastAPI backend running locally on **port 2200** with a working
  `POST /predict` endpoint (this project does not modify or mock it)
- Any way to serve static files locally (a live-server extension, or
  Python's built-in server below). Opening `index.html` directly by
  double-clicking usually works too, since the backend's CORS is set to
  allow all origins — but a local server is the more reliable option.

## Running it

1. Start the backend: `uvicorn <your_file_name>:app --reload --port 2200`
2. Serve this folder, e.g.:
   ```bash
   python3 -m http.server 5500
   ```
3. Open `http://localhost:5500` in your browser.
4. The navbar's status dot turns green once it can reach the backend.

## File structure

```
index.html   markup for every section (navbar, header, form, result card, signals, footer)
styles.css   design tokens, resets, and every component's styles, in one file
script.js    all application logic, organized into clearly commented sections:
               1. Data           — dropdown options + validation ranges
               2. API layer      — fetch calls to FastAPI (POST /predict, health check)
               3. Validation     — mirrors the backend's Pydantic constraints
               4. DOM setup      — populates selects/datalist, reads form values
               5. Result card    — idle / loading / error / success rendering + gauge
               6. Signals        — prediction summary + behavioral signal cards
               7. Navbar status  — polls the backend every 15s
               8. Wiring         — event listeners tying it all together
```

## Notes

- The frontend sends exactly the JSON keys the backend expects (`age`,
  `avg_daily_usage_hours`, `stress_level`, etc.), never the model's
  internal dataframe column names.
- The predicted score is shown exactly as the API returns it; the
  circular gauge is a visual aid scaled 0–10 for display purposes only,
  and the label never asserts a confirmed `/10` unit.
- Architecture, dataset, and EDA details are documented in the React
  version's README — this build is UI-only, focused on the prediction
  experience.
- This is an educational ML project, not a medical diagnostic tool.
