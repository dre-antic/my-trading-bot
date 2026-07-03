import os
import ccxt
import pandas as pd
from datetime import datetime

# ============ CONFIG ============
SYMBOL = 'BTC/USDT'
TIMEFRAME = '1h'
RSI_PERIOD = 14
RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70
TRADE_AMOUNT_USDT = 10

# ============ SETUP EXCHANGE ============
exchange = ccxt.binance({
    'apiKey': os.getenv('BINANCE_API_KEY'),
    'secret': os.getenv('BINANCE_SECRET'),
    'enableRateLimit': True,
    'options': {'defaultType': 'spot'}
})
exchange.set_sandbox_mode(True)

# ============ FUNCTIONS ============
def fetch_data():
    ohlcv = exchange.fetch_ohlcv(SYMBOL, TIMEFRAME, limit=50)
    df = pd.DataFrame(ohlcv, columns=['timestamp','open','high','low','close','volume'])
    df['close'] = df['close'].astype(float)
    return df

def get_rsi(df, period=14):
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.iloc[-1]

def get_balances():
    bal = exchange.fetch_balance()
    usdt = bal['USDT']['free'] if 'USDT' in bal else 0
    btc = bal['BTC']['free'] if 'BTC' in bal else 0
    return float(usdt), float(btc)

# ============ MAIN LOGIC ============
def run():
    print(f"\n🤖 Bot firing at {datetime.now().strftime('%H:%M:%S')}")

    df = fetch_data()
    current_price = df['close'].iloc[-1]
    rsi = get_rsi(df)
    usdt, btc = get_balances()

    print(f"💰 Price: ${current_price:,.2f} | RSI: {rsi:.1f}")
    print(f"📊 Wallet: {btc:.6f} BTC | ${usdt:.2f} USDT")

    if rsi < RSI_OVERSOLD and usdt >= TRADE_AMOUNT_USDT:
        amount = TRADE_AMOUNT_USDT / current_price
        print(f"🟢 BUY SIGNAL! Snagging ${TRADE_AMOUNT_USDT} of BTC...")
        # exchange.create_market_buy_order(SYMBOL, amount)
        print("   (Paper trade - uncomment the line above to actually execute)")

    elif rsi > RSI_OVERBOUGHT and btc > 0.0001:
        print(f"🔴 SELL SIGNAL! Dumping BTC...")
        # exchange.create_market_sell_order(SYMBOL, btc)
        print("   (Paper trade - uncomment the line above to actually execute)")

    else:
        print("😴 No signal. Bot goes back to sleep.")

if __name__ == "__main__":
    run()
