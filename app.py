"""M&G fund debt stack dashboard — static server plus the market data hook.

The whole front end is static (index.html + assets/). The only server-side
concern is market data: the "Live market data" panel on the Overview tab and
the Euro market dashboard tab both read one endpoint, /api/market-data, which
is served by get_market_data() below.

    To reconnect the panel to the internal market data feed, replace the body
    of get_market_data() (or point MARKET_DATA_SOURCE at your provider and add
    a branch). Keep the response shape and the front end needs no change:

        {
          "source":  "<human-readable provider name, shown in the caption>",
          "delayed": true | false,        # true renders the amber
                                          # "Indicative, delayed data" badge
          "asOf":    "<ISO-8601 timestamp, shown in the caption>",
          "rates": [                      # Overview strip
            {"key": "eur_swap_5y", "label": "EUR swap 5Y",
             "value": 3.15, "unit": "%", "change": 0.02},
            ...
          ],
          "board": [                      # Euro market dashboard tab
            {"name": "Govvies", "unit": "bp", "dir": "rates", "rows": [
              {"label": "Bund 5-year", "today": "3.00%",
               "dod": 2, "wow": 2, "ytd": 56},
            ]},
            ...
          ]
        }

If the endpoint is unavailable (for example on a purely static deployment)
the page falls back to DATA.marketFallback in assets/data.js, so the layout
never renders empty.
"""

import os
from datetime import datetime, timezone

from flask import Flask, jsonify, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

# ---------------------------------------------------------------------------
# Market data configuration — the one place to switch feeds.
# ---------------------------------------------------------------------------
# "sample"   — the indicative placeholder levels below (default).
# "internal" — internal market data feed; wire it up in get_market_data().
MARKET_DATA_SOURCE = os.environ.get("MARKET_DATA_SOURCE", "sample")

# Indicative placeholder levels. Replace with the live feed, not by editing
# these numbers in production.
SAMPLE_RATES = [
    {"key": "eur_swap_5y", "label": "EUR swap 5Y",        "value": 3.15, "unit": "%",   "change": 0.02},
    {"key": "euribor_3m",  "label": "3M EURIBOR",         "value": 1.95, "unit": "%",   "change": -0.02},
    {"key": "ecb_depo",    "label": "ECB depo rate",      "value": 2.00, "unit": "%",   "change": 0.00},
    {"key": "langford_z",  "label": "Langford Z-spread",  "value": 96,   "unit": "bps", "change": -1},
]

# Euro market dashboard sections. `dir` drives the colour convention in the
# front end: "rates"/"risk" read as a cost (a rise is red), "assets" read as
# performance (a rise is green).
SAMPLE_BOARD = [
    {"name": "Govvies", "unit": "bp", "dir": "rates", "rows": [
        {"label": "UKT 5-year",  "today": "4.60%", "dod": 3, "wow": 2,  "ytd": 55},
        {"label": "Bund 5-year", "today": "3.00%", "dod": 2, "wow": 2,  "ytd": 56},
        {"label": "UST 5-year",  "today": "4.40%", "dod": 0, "wow": -2, "ytd": 68},
    ]},
    {"name": "EUR Midswaps", "unit": "bp", "dir": "rates", "rows": [
        {"label": "MS 3-year",  "today": "3.11%", "dod": 2, "wow": 3, "ytd": 73},
        {"label": "MS 5-year",  "today": "3.15%", "dod": 2, "wow": 3, "ytd": 58},
        {"label": "MS 6-year",  "today": "3.18%", "dod": 2, "wow": 3, "ytd": 52},
        {"label": "MS 7-year",  "today": "3.21%", "dod": 2, "wow": 3, "ytd": 47},
        {"label": "MS 10-year", "today": "3.31%", "dod": 2, "wow": 3, "ytd": 38},
    ]},
    {"name": "Credit Indices", "unit": "bp", "dir": "risk", "rows": [
        {"label": "iTraxx Main (bps)",  "today": "51",  "dod": 0, "wow": -1, "ytd": 0},
        {"label": "iTraxx Xover (bps)", "today": "247", "dod": 0, "wow": -4, "ytd": 3},
    ]},
    {"name": "Fund Credit", "unit": "bp", "dir": "risk", "rows": [
        {"label": "Langford 4.000% 2031 Z-spread", "today": "96",  "dod": -1, "wow": -4, "ytd": None},
        {"label": "Hines comparable Z-spread",     "today": "101", "dod": 0,  "wow": -3, "ytd": None},
    ]},
    {"name": "Commodities", "unit": "%", "dir": "assets", "rows": [
        {"label": "Brent", "today": "90", "dod": -0.2, "wow": -5.1, "ytd": 47.2},
        {"label": "WTI",   "today": "83", "dod": -0.6, "wow": -4.7, "ytd": 44.5},
    ]},
    {"name": "Equities", "unit": "%", "dir": "assets", "rows": [
        {"label": "FTSE 100",  "today": "10,816", "dod": 0.2, "wow": 0.0, "ytd": 8.9},
        {"label": "EUROSTOXX", "today": "6,473",  "dod": 0.8, "wow": 0.2, "ytd": 11.8},
        {"label": "S&P",       "today": "7,731",  "dod": 0.7, "wow": 1.2, "ytd": 12.9},
    ]},
]


def get_market_data():
    """Return the indicative rates shown in the Overview market panel.

    This is the single swappable source. Everything downstream — the panel
    layout, the delayed-data badge and the source caption — is driven by the
    dict returned here.
    """
    if MARKET_DATA_SOURCE == "internal":
        # Replace with the internal feed call, e.g.:
        #   quotes = market_data_client.snapshot(["EUSA5", "EUR003M", ...])
        #   return {"source": "M&G market data (internal)", "delayed": False,
        #           "asOf": quotes.timestamp.isoformat(), "rates": [...]}
        raise NotImplementedError("Internal market data feed is not wired up yet")

    return {
        "source": "Indicative sample levels (app.py)",
        "delayed": True,
        "asOf": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "rates": SAMPLE_RATES,
        "board": SAMPLE_BOARD,
    }


@app.route("/api/market-data")
def market_data():
    try:
        payload = get_market_data()
    except NotImplementedError as exc:
        # Let the front end fall back to its static values rather than
        # rendering an empty panel.
        return jsonify({"error": str(exc)}), 503
    return jsonify(payload)


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", 8000))
    app.run(host="0.0.0.0", port=port)
