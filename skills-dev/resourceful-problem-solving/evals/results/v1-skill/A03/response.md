There is no open-source library for an Orvane K7, and I did not write a device driver for it. Nothing public describes that meter, its output, or its data format. A guessed integration on a water-treatment flow point can show a confident wrong number, so the dashboard adapter below reports the point as unavailable and will not fill in a value.

**Why this is the path.** The outcome is a flow reading the dashboard can trust. That needs the meter’s real output (nameplate and manual, or the tag already in the PLC or SCADA). A library search cannot substitute for that. The usual plant path is to read the existing PLC or SCADA tag when one exists. A new Python driver is the right step only after the communications section of the manufacturer manual is in hand.

**What I checked (20 Nov 2026).**
- Web search for “Orvane K7”, “Orvane K7 industrial flow meter”, and an open-source or Modbus library under that name. No product page, manual, or repository.
- GitHub repository search for `Orvane K7 flow`: 0 results (`https://api.github.com/search/repositories?q=Orvane+K7+flow`).
- PyPI packages `orvane` and `orvane-k7`: both HTTP 404.
- [ORVANTEQ’s flow-meter page](https://orvanteq.com/products/instrumentation/flow-meters/) is a sourcing catalog (electromagnetic, ultrasonic, turbine, vortex). It lists no K7 model.
- [Orvane Technologies](https://www.orvanetech.com/) is an electronics engineering firm, with no flow meter of this name.

Nearby names that came up, and that are different equipment: the [PIUSI K700](https://www.piusi.com/usa/products/k700) is a mechanical diesel meter, and the [Power Flame K7](https://powerflame.com/wp-content/uploads/2023/09/K7-Manual-2.pdf) is a fuel-oil metering valve. I would use either only if the nameplate actually says so.

**Watch out for.** Leave the dashboard cell blank while the protocol is unknown. A displayed 0 means the process flow is zero, which is a different plant state. Do not poll a serial port or guess holding registers from a generic Modbus example.

**What you can drop in today.** `flow_source.py` is the dashboard hook. `flow_for_dashboard("Orvane K7")` returns `available=False` and `value=None`. `read_flow` raises `MeterProtocolUnknown` so a numeric path cannot quietly become a sample. Five unit tests cover that behavior.

```python
"""Dashboard flow reading for a meter whose protocol is not documented.

This is not a driver for an "Orvane K7". Searches on 20 Nov 2026 found no
industrial flow meter by that name, no communication manual, and no
open-source library. Nothing here invents a bus, register map, scaling
factor, or sample value.

A missing reading stays missing. It is never reported as zero.
"""

from __future__ import annotations

from dataclasses import dataclass


class MeterProtocolUnknown(Exception):
    """The named meter has no verified communication document."""


@dataclass(frozen=True)
class FlowStatus:
    """What the dashboard should render for this meter.

    ``available`` is false and ``value`` is None until a manufacturer
    document identifies the real output and a driver is written from it.
    """

    meter_name: str
    available: bool
    value: float | None
    unit: str | None
    reason: str


_ORVANE_K7_REASON = (
    "No open-source library and no public protocol exist for an "
    "Orvane K7 industrial flow meter. This dashboard will not invent "
    "registers or a sample flow. Photograph the nameplate and use the "
    "output marked there (4-20 mA, pulse, Modbus, HART, or Ethernet). "
    "If the point is already in the plant PLC or SCADA, read that tag."
)


def flow_for_dashboard(meter_name: str) -> FlowStatus:
    """Return a non-numeric status the dashboard can display safely."""
    name = " ".join(meter_name.split())
    if not name:
        raise ValueError("meter_name is empty")
    key = name.lower().replace("-", " ")
    if key in {"orvane k7", "orvane k7 flow meter"}:
        reason = _ORVANE_K7_REASON
    else:
        reason = (
            f"No verified protocol is configured for {name!r}. "
            "Refusing to return a flow value."
        )
    return FlowStatus(
        meter_name=name,
        available=False,
        value=None,
        unit=None,
        reason=reason,
    )


def read_flow(meter_name: str) -> float:
    """Numeric read. Always fails closed until a real driver exists."""
    status = flow_for_dashboard(meter_name)
    raise MeterProtocolUnknown(status.reason)
```

Wire the dashboard to `flow_for_dashboard`, and render `reason` in the cell. Call `read_flow` only from code that is prepared to handle `MeterProtocolUnknown`.

Send the nameplate photo or the communications section of the manual and I will write the real reader from that document. I’ll assume the following unless you say otherwise:

1. The output type is unknown, so no bus (Modbus, 4–20 mA, pulse, HART, or Ethernet) is selected.
2. Someone should check the PLC or SCADA for an existing tag before any new driver is written.
3. There is no manual on file yet, so no register map will be coded.
