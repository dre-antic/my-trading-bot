Use Shopify’s ready-made store, on the Basic plan, with Shopify’s free Subscriptions app. You set it up in a browser. Shopify hosts the shop, takes the cards, charges the monthly box, and emails you who to ship to. You never build a website or touch code.

I’m assuming you’re in the United States, starting from scratch, and that the subscription is one curated box a month (you choose the candles). Defaults are at the end if any of that is wrong.

## Why this, and what it costs

A stranger has to be able to pay you for a single candle, and a subscriber has to be billed again every month without you sending invoices by hand. Shopify Basic does both.

As listed on [Shopify’s pricing page](https://www.shopify.com/pricing) on November 20, 2026:

- Basic is **$39 USD a month**, or **$29 a month** if you pay for a year up front. Pay month to month.
- New stores are offered **3 days free, no credit card**, then **$1 a month for 3 months** on most plans, then the normal price. Read the price on your own signup screen before you add a card. If it does not say $1, the real price is $39 a month.
- A normal online card costs **2.9% + 30¢**. Some cards cost **3.5% + 30¢**. Cards from outside the US add about **1%**.
- Shopify Tax is free until the store has **$100,000** in lifetime sales, then **0.35%** of the order (capped at 99¢) on orders where you collect tax. That is from [Shopify’s tax pricing](https://help.shopify.com/en/manual/taxes/shopify-tax/pricing). Ignore it at launch.
- You can buy and print shipping labels inside Shopify. Set a flat shipping price yourself. Live carrier rates at checkout are a higher-plan feature.

The Subscriptions app is free, made by Shopify, and works for physical products ([app listing](https://apps.shopify.com/shopify-subscriptions), [plan setup](https://help.shopify.com/en/manual/products/purchase-options/subscriptions/shopify-subscriptions/manage-subscriptions/add-edit-plans)). It needs Shopify Payments, which is available for US businesses ([supported countries](https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries)). You must be 18, and payouts go to a US checking account that accepts ACH, or to Shopify Balance.

Etsy is where people already search for handmade candles, and opening a shop has no monthly fee. Etsy’s own selling page only describes one-time fees (20¢ to list, 6.5% when it sells, and about 3% + 25¢ to process the payment in the US). It has no tool for you to bill a subscriber every month. Square’s online plan that includes subscriptions is **$49 a month** ([Square’s online store plans](https://squareup.com/us/en/online-store)), which costs more than Shopify Basic for the same job.

## How the shop should work

Keep the first version small.

**Four one-time candles, plus one box.** More scents can wait until these sell. Use scents you have already burn-tested. The names below are samples. Replace every one before you publish.

**One subscription product, called “Monthly Candle Box.”** The product stays the same every month. You change what you pack inside, and you put a short card in the box saying what this month’s candles are. Shopify’s app cannot swap a new product into subscriptions that already exist, and a shop owner said the same thing in a review on November 13, 2026. A stable box product avoids that.

**Bill on the 1st** when you create the plan (Shopify’s help page has “Set a specific billing day”). People who join mid-month may be charged a partial amount or the full price, depending on the option you pick. Pick **charge full price** only if they get a full box right away. Renewals are charged the day after they’re due, at 10:00 a.m. in your store’s time zone ([Shopify’s notes on subscriptions](https://help.shopify.com/en/manual/products/purchase-options/subscriptions/shopify-subscriptions/considerations)). Pour that month’s candles after the order shows as paid.

**Ship only in the United States for now.** Shopify’s international program, Managed Markets, restricts candles and also restricts subscriptions. Leave it off.

**Do not buy a theme, a domain, or another app.** The free theme and the free `your-store.myshopify.com` address are enough. Add a domain after real orders are coming in.

## Price check before you publish

On a normal US card, Shopify keeps `price × 0.029 + $0.30`.

Example only, for a $28 candle. Replace every number with yours.

| | Example |
|---|---|
| Selling price | $28.00 |
| Card fee ($28 × 0.029 + $0.30) | $1.11 |
| Shipping label | $6.50 |
| Jar, wax, wick, oil, label | $6.00 |
| Left for your time | $14.39 |

Do the same for the box, and count every candle that goes in it. Weigh a packed candle and a packed box, then look at the label price Shopify offers. If “left for your time” is too small, raise the price. Candles are heavy, so a too-low shipping price is the usual way these shops lose money.

## Do this in order

1. Go to [shopify.com/pricing](https://www.shopify.com/pricing) and start the free trial. Use an email you check. Skip the yearly plan.
2. When it asks what you sell, say physical products. Skip extra apps and skip Managed Markets.
3. Stay on the password page while you build. In the admin search box, type `password` if you need to find it.
4. Add four candle products and the Monthly Candle Box. Paste the text below, then replace the sample scents, weights, and prices.
5. Settings → Payments. Turn on Shopify Payments and enter your bank account and identity details. Shopify holds the card numbers. You never see the full card.
6. Settings → Shipping. Add one flat rate for the US from your real label quote. Add a higher rate for the box if it weighs more.
7. Settings → Taxes and duties → United States. Turn on collection for your state.
8. Install **Shopify Subscriptions** (free, developer: Shopify). Apps → Subscriptions → Plans → Create plan.
   - Title: `Monthly Candle Box`
   - Product: only the Monthly Candle Box
   - Delivery: every 1 month
   - Billing day: the 1st
   - No end date
   - No discount until the single-candle prices are working
9. Online Store → Edit theme → product template → Add block → **Subscription widget** → Save. Use the free theme Shopify already installed. If a help page mentions editing theme code, skip that. The block is enough on current themes.
10. Let customers cancel without emailing you. Settings → Checkout → Edit → add the Subscriptions app’s **Subscription management** block to customer accounts, and add **Manage subscription** on the thank-you page. Save.
11. Settings → Policies. Paste the subscription policy below into the purchase-options cancellation policy.
12. Buy the $1 test only while the store is still password-protected: add a product called Test for $1, purchase it yourself, confirm the order email arrives, refund it, and delete that product.
13. Remove the password. Send the link to 10 people who already know you. Friends, neighbors, and a local market are the first customers. The shop will not get strangers on its own. Skip ads until those 10 people have seen it.
14. Put a reminder on your calendar one week before the $1 period ends. If you have not shipped a paid order and you do not want $39 a month, cancel in Settings → Plan before that date.

## Text to paste

Replace anything in brackets. Delete a sample candle you do not actually make.

**Candle product (copy four times)**

Title: `[Scent name] soy candle`

Description:

> Hand-poured soy candle in a glass jar. Net wax weight [8 oz / 227 g].
>
> Scent: [what it actually smells like, in one sentence].
>
> Burned within sight, on a stable heat-safe surface, it lasts about [hours from your own test]. Trim the wick to 1/4 inch before each lighting. Stop burning when 1/2 inch of wax remains.
>
> Poured by [your name] in [city, state].

Price: from your worksheet. Charge shipping on top.

**Monthly Candle Box**

Title: `Monthly Candle Box`

Description:

> Two hand-poured candles, chosen by me for that month, packed and shipped to you. A card in the box names the scents.
>
> Billed every month. You can skip, pause, or cancel in your account before the next charge. I ship after the payment goes through, within [5] business days, to US addresses only.
>
> The first box ships as soon as your first payment clears. Later boxes ship after each monthly payment.

**Subscription policy**

> The Monthly Candle Box renews every month until you cancel. You can skip a month, pause, or cancel from your account. Cancel before your next billing date so you are not charged for the following box. Payments that fail are not shipped. Shipping is only inside the United States. Each box contains two candles I choose for that month. Because the candles change, completed orders are not refundable once shipped, except for damage. If a jar arrives broken, email me a photo within 7 days and I will replace it or refund that order.

**About (short)**

> I pour these candles myself in [city, state]. This shop sells the candles I have on hand, and a box of two candles once a month. Questions: [your email].

## Before you ship to anyone but yourself

- Use wicks with **no metal core**. In the US, a metal core that is more than 0.06% lead is illegal ([CPSC candle guidance](https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Candles)). Keep the supplier’s invoice.
- Use fragrance and wax the way the maker says, including the maximum oil amount. Burn-test each new scent before it goes on sale.
- Put a fire warning on the jar, not only on the website. The industry label standard is ASTM F2058. It is voluntary, and it is the label buyers expect. Buy pre-printed labels so the symbol and letter size are already right. The warning says: **WARNING. Burn within sight. Keep away from things that catch fire. Keep away from children.** Also print the wax weight and your city and state.
- Ask your city whether a home business needs a permit, and ask your home insurer about product liability. A normal homeowner policy often skips business products. A candle fire is the claim that matters.
- This setup guide is not legal advice.

## Watch for these

- The $1 price ends. After that, Basic is $39 a month even in a month with zero sales.
- Card fees come out of every order, including the box.
- Make candles for a renewal only after that order is paid.
- A November 2026 review said the app would not move everyone onto one billing date. If you do not see “specific billing day” when you create the plan, let each person renew on their signup day and ship within 5 business days of payment.
- Leave Managed Markets off.

If Shopify Payments is refused, stop. Don’t collect card numbers yourself, and don’t buy a paid subscription app to work around it.

I’ll assume the United States, US dollars, a curated two-candle box, and a brand-new shop unless you say otherwise. If you’re in another country, tell me the country before you enter a bank account. Payment setup and candle rules change, and that is the one fact that would change this plan.
