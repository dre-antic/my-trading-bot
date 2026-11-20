Stop the daily scraper. Use Distill to email you when a competitor's selling price changes to a number below yours.

The comparison app was built for a daily report. You now want an undercut alert, and two of the five sites are already refusing the scraper. Checking those sites more often with our own code would make that worse. I am not going to work around the block with proxies, stealth browsers, or captcha-solving. A page monitor already does the job you described.

## Recommendation

Use [Distill](https://distill.io/pricing/). On each competitor product page, select only the selling price and add one condition: **Text → has number less than → your price**. Distill emails you when that price changes and the new number is under yours.

Run it in two steps on the same monitors:

1. **Today, free, in your browser.** Install the Distill extension and leave the monitors on your computer. Local checks are unlimited and can run every few minutes (the minimum is 5 seconds). The browser has to stay open.
2. **When you want alerts with the computer off,** move those monitors to Distill's cloud on the **Starter plan at $15/month**. Cloud checks can run every 10 minutes. Five product pages at that interval use about 21,600 checks in a 30-day month, and Starter includes 30,000.

Turn off the scheduled Python job so it stops requesting those sites. The two scrapers that already work are not worth keeping as a running app.

## Why this fits

The success test is an email when a tracked price moves under yours, and silence when it does not. Distill's numeric condition is that test. A hosted price-intelligence suite is built for catalogs and repricing, and it is slower than this at a much higher price.

## What I checked

Figures are from the vendors' own pages, fetched 20 Nov 2026.

[Distill's pricing](https://distill.io/pricing/) lists:

- **Free:** 25 monitors, 5 of them in the cloud, cloud checks no more often than every 6 hours, 1,000 cloud checks a month, 30 emails a month.
- **Starter, $15/month:** 50 monitors, cloud checks down to every 10 minutes, 30,000 cloud checks a month.
- **Professional, $35/month:** 150 monitors, cloud checks down to every 5 minutes, 100,000 cloud checks a month.

A cloud check that takes longer than 10 seconds counts as more than one check. Five slow pages can use the Starter allowance twice as fast, so look at usage after a day and lengthen the interval if it is climbing too quickly.

[Local vs cloud](https://distill.io/docs/web-monitor/cloud-local-monitors/): cloud checks keep running with your computer off. Local checks use your browser or the desktop app and run only while that app is open. Extension checks open the page in a tab by default; background checks are only for static pages. Local checks do not count against the monthly check cap.

[Conditions](https://distill.io/docs/web-monitor/using-conditions-to-get-alert-on-important-changes/): Distill alerts only after the selected text changes, and only if the condition is also true. `has number less than` is the price rule. If the selection contains several numbers, any one of them can fire the alert, so the selection has to be the selling price alone. A competitor who is already cheaper, and whose price then sits still, does not produce an email.

[Prisync's plan page](https://prisync.com/compare-plans/) is the serious alternative, and it loses for this goal. URL-based monitoring starts at $99/month for up to 100 products, updated three times a day, with price-position comparison. Daily email starts at Premium, $199/month. "Instant" email is Platinum, $399/month. [Prisync's own alert page](https://prisync.com/features/instant-price-change-notifications/) says the engine runs three cycles a day and the instant email goes out at the end of each cycle. Their threshold is "email me if the change is larger than this percent," which is a different rule from "below my price."

[Visualping's pricing](https://visualping.io/pricing) is a poor fit for frequent checks. The free plan is 5 pages and 150 checks a month, which they describe as about once a day. The $14 plan includes 1,000 checks a month, which cannot keep a 15-minute schedule even for one page.

## Watch out for

- If a check comes back as a block page or a captcha, turn that monitor off. For a site that blocks Distill's servers, run it as a local monitor in your own browser. Leave captcha-solving and proxies off. If your own browser is blocked too, or the site's terms forbid automated checks, look at that site yourself.
- Prices written as `1.299,00` need Distill's European number format. The default reads `1,299.00`.
- When you change your own price, edit the condition. Distill only knows the number you type.
- A grey Distill icon in the browser means local monitoring is off.
- Another change while the price is still under yours can email you again. That is the rule working, not a second product.

## Do this first

1. Turn off the daily scraper schedule.
2. Install the Distill extension for Chrome, Firefox, Edge, or Opera and create an account.
3. Open a competitor product page, start a monitor, and click only the selling price. Repeat for each product you care about.
4. On the monitor: menu → **Edit Options** → **Add Condition**. Set **Text**, **has number less than**, and your price. Add an email action to your address. Leave the monitor on this browser.
5. Use **Test Condition** with sample text. `79.00` should pass when your price is above 79, and `129.00` should fail.
6. Set the local interval to 5 minutes and leave the browser open long enough to see one successful check in the log.
7. Write down the five current prices today. Anyone already below you will stay silent until their price changes again.
8. When that test looks right, switch the device to cloud and use Starter at a 10-minute interval so it keeps watching with the computer off.

## Backup

Move to Prisync URL-based Premium ($199/month) or above if you later track dozens of products and want a price-position dashboard or automatic repricing. For a handful of pages, Distill is the faster and cheaper alert.

Automatic repricing can wait. The undercut email is the whole job for now.

## Assumptions

I will keep going on these unless you say otherwise:

1. You are watching about one product page per competitor, five pages. Past six pages, a 10-minute cloud interval no longer fits Starter's 30,000 checks (each page is about 4,320 checks a month, double that if a page takes over 10 seconds). I would then use a 15-minute interval, or Professional at $35/month for 5-minute checks.
2. An email within about 10 minutes is fast enough. If you need faster and a computer can stay on, stay on the free local monitors and skip the $15.
3. You can open the two blocked sites in your own browser and see the price. If you cannot, those two stay manual.

Sources:

- [Distill plans and pricing](https://distill.io/pricing/) (fetched 20 Nov 2026)
- [Distill: optimizing alerts with conditions](https://distill.io/docs/web-monitor/using-conditions-to-get-alert-on-important-changes/) (fetched 20 Nov 2026)
- [Distill: local monitor vs cloud monitor](https://distill.io/docs/web-monitor/cloud-local-monitors/) (fetched 20 Nov 2026)
- [Prisync pricing and plans](https://prisync.com/compare-plans/) (fetched 20 Nov 2026)
- [Prisync instant price change notifications](https://prisync.com/features/instant-price-change-notifications/) (fetched 20 Nov 2026)
- [Visualping pricing](https://visualping.io/pricing) (fetched 20 Nov 2026)
