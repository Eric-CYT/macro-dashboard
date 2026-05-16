const FRED_KEY = "2fc56441b7381e279678fe288355bcf5";

// 從 FRED 抓最新兩筆數據
async function fetchFred(seriesId) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=2`;
    const res = await fetch(url);
    const json = await res.json();
    const obs = (json.observations || []).filter(o => o.value !== ".");
    if (obs.length >= 2) {
      return { value: parseFloat(obs[0].value), prev: parseFloat(obs[1].value) };
    }
    return null;
  } catch (e) {
    console.error(`FRED ${seriesId} error:`, e.message);
    return null;
  }
}

// 從 CoinGecko 抓加密市場主導率
async function fetchCrypto() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global");
    const json = await res.json();
    const pct = json.data?.market_cap_percentage || {};
    return { btc: pct.btc || 0, usdt: pct.usdt || 0, usdc: pct.usdc || 0 };
  } catch (e) {
    console.error("CoinGecko error:", e.message);
    return null;
  }
}

export default async function handler(req, res) {
  // 允許瀏覽器直接讀取
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  try {
    // 並行抓取所有 FRED 數據
    const [walcl, m2sl, fedfunds, rrpon, dgs2, dgs10, vix, dxy, gold, crypto] = await Promise.all([
      fetchFred("WALCL"),
      fetchFred("M2SL"),
      fetchFred("FEDFUNDS"),
      fetchFred("RRPONTSYD"),
      fetchFred("DGS2"),
      fetchFred("DGS10"),
      fetchFred("VIXCLS"),
      fetchFred("DTWEXBGS"),
      fetchFred("GOLDAMGBD228NLBM"),
      fetchCrypto(),
    ]);

    const today = new Date().toISOString().slice(0, 10);

    const data = {
      WALCL:     { ...(walcl  || { value: 6719,  prev: 6700  }), unit: "十億USD", name: "聯準會資產負債表" },
      M2SL:      { ...(m2sl   || { value: 21580, prev: 21540 }), unit: "十億USD", name: "M2 貨幣供給" },
      FEDFUNDS:  { ...(fedfunds||{ value: 4.33,  prev: 4.33  }), unit: "%",       name: "聯邦基金利率" },
      RRPONTSYD: { ...(rrpon  || { value: 165,   prev: 180   }), unit: "十億USD", name: "隔夜逆回購" },
      DGS2:      { ...(dgs2   || { value: 3.97,  prev: 3.95  }), unit: "%",       name: "2Y殖利率" },
      DGS10:     { ...(dgs10  || { value: 4.48,  prev: 4.46  }), unit: "%",       name: "10Y殖利率" },
      VIX:       { ...(vix    || { value: 18.43, prev: 17.90 }), unit: "",        name: "VIX 恐慌指數" },
      DXY:       { ...(dxy    || { value: 99.27, prev: 98.60 }), unit: "",        name: "美元指數" },
      GOLD:      { ...(gold   || { value: 4562,  prev: 4693  }), unit: "USD/oz",  name: "黃金" },
      BTC_D:     { value: crypto?.btc  || 58.2, prev: 58.4,  unit: "%", name: "BTC 主導率" },
      USDT_D:    { value: crypto?.usdt || 6.5,  prev: 6.4,   unit: "%", name: "USDT 主導率" },
      USDC_D:    { value: crypto?.usdc || 2.8,  prev: 2.7,   unit: "%", name: "USDC 主導率" },
      date: today,
    };

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
