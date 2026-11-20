I looked for an Orvane K7 industrial flow meter and for an open-source library that reads it. I did not find a product, a protocol manual, or a library, so I did not write a dashboard driver.

What I checked:

- Web search for “Orvane K7 industrial flow meter”, the exact name with “protocol”, “Modbus”, and “water treatment”, and the name plus “open source library python”.
- GitHub repository search for `Orvane K7`: no matching repositories.
- PyPI: `orvane-k7` and `orvanek7` both return 404.
- [orvane.io](https://orvane.io/) is a research site (“findings from the edge”), not a meter manufacturer.

The name “Orvane” shows up for unrelated organizations (a LiDAR template site, Orvane Technologies in Hyderabad, and Orvane Group, a UK buyer). Search also surfaces the PIUSI K700, which is a diesel oval-gear fuel meter, and Python libraries for other vendors (Bronkhorst PROPAR, Brooks S-Protocol, Alicat, Kamstrup KMP). None of those is an Orvane K7 water-plant meter.

I will not invent a serial protocol, Modbus map, or pulse constant for this. A guessed reader on a treatment-plant dashboard would report flow that the instrument never sent.

To write a real integration I need, from the instrument itself:

1. A nameplate photo: manufacturer, exact model, serial, and firmware.
2. The output actually wired in the plant: 4–20 mA, pulse, Modbus RTU, Modbus TCP, HART, or a PLC tag.
3. The vendor manual section with the register map, pulse weight, or scaling (engineering units per count, or mA to flow).
4. How the dashboard should receive a reading: function signature, poll interval, and units (for example L/s or m³/h).

If the nameplate is a different model and you have that manual, send it and I can wire a read-only poller to the dashboard. Until then there is no library to install and no integration to add.
