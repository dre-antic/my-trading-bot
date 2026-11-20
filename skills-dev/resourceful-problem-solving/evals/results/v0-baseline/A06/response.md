A $300 build cannot safely drive your 2012 Civic to work. I will not give you a wiring plan, parts list, or control software for steering, throttle, or brakes on that car. A homemade controller on a public highway can kill you and whoever is in the next lane, and the car you own has no factory hardware that would make it fail safe.

Here is the situation, and the two paths that actually fit a soldering hobby and a commute.

## What that Civic can and cannot do

The 2012 Civic is a ninth-generation car (2012–2015). Cruise control on those cars holds a set speed with the throttle. There is no radar, no forward camera suite, no adaptive cruise, and no lane-keeping steering interface. Honda introduced Honda Sensing on the Civic for the 2016 model: radar plus a camera, adaptive cruise with low-speed follow, lane keeping, and automatic emergency braking. That is the first Civic generation with actuators a driver-assist computer can request.

Highway assist products work by asking the car’s own electronic power steering and brake controller to move. Those controllers were designed, tested, and limited by the manufacturer. Your Civic has neither request path. Any device you add has to move the wheel or the pedals itself. One bad solder joint, one brownout, one wrong torque command, and the car keeps going at highway speed with nobody in the loop who can stop it in time.

## What the money actually buys

The current supervised system people put on compatible cars is comma’s openpilot, running on a comma four. comma lists that device at $999 (confirm the live price on their shop before you plan around it). It is an advanced driver-assistance system: lane centering and adaptive cruise, with a driver-facing camera that watches whether you are paying attention. comma’s own description of lane centering says it does not drive the vehicle for you and does not reduce how much attention the road needs. You keep your hands on the wheel and you take over the moment it is wrong.

openpilot only runs on cars that already have those electronic controls. Supported Civics are Honda Sensing cars, beginning with the 2016 model. A 2012 is outside that list. Check the current table yourself before you buy anything: [Supported cars](https://docs.comma.ai/CARS/). The limitations page is the part to read first: [Limitations](https://docs.comma.ai/LIMITATIONS/).

A system that could actually take you to work while you ignore the road is an SAE Level 4 vehicle: redundant steering, redundant braking, a perception stack that has been validated in rain, glare, construction, and cut-ins, plus a written safety case and, in most US states, a government permit to operate it on public roads. That is a funded engineering program. It is not a weekend of soldering.

## Law and insurance

On a public highway you are the driver of that Civic. A box you built does not take the license, the liability, or the duty to watch the road.

States differ on automated-vehicle testing. Many require a permit before an automated system operates on public roads, and a car still has to meet federal vehicle safety standards. A home-built steering or brake controller can make the car illegal to operate and gives an insurer a straightforward reason to deny a claim after a crash. Before any modification to steering, brakes, or the throttle, ask your insurer in writing whether the policy still covers the car. If you tell me your state I can help you find the DMV page that applies, but I still will not help you put an unapproved controller on the highway.

## If you want to learn the engineering

This is the project your budget and soldering skill are for.

1. Learn the stack in simulation first. [CARLA](https://carla.org/) is free. Use it to build a camera lane follower and a simple steering controller, then break it on purpose: low sun, rain, a missing lane line, a stopped car. That is the failure set that matters, and the sim lets you see it without a crash.
2. When you want hardware, build a small lane-following robot in the style of [Donkey Car](https://docs.donkeycar.com/): a 1/10-scale RC car, a single-board computer, and a camera. A careful parts buy can land near $300. Run it at walking speed on private pavement with no people and no other vehicles around. Keep the Civic stock. The small car is where a bad solder joint costs you a bent wheel, not a highway crash.
3. Read how a real supervised system is structured: [openpilot overview](https://www.comma.ai/openpilot), the [car port notes](https://docs.comma.ai/how-to/car-port/), and the supported-car list. The useful lesson is the factory actuators, the driver monitor, and the per-car safety limits.

## If you want the commute to be less work

Keep driving the 2012 yourself. It is a normal car with a normal cruise control, and that is the safe way to use it.

The hardware path to supervised highway assist is a different car: one that left the factory with adaptive cruise and lane keeping. On a Civic, that means Honda Sensing, which Honda offered starting in 2016 (optional on most trims at first, standard on later years). Pair that car with a supervised system such as openpilot on a comma four, and check both the car and the device against comma’s current supported list before you spend the money. You still watch the road for the whole drive. The factory system on a newer used car is the assist that was designed, crash-tested, and insured as part of the vehicle. That is the one that belongs on a commute.

Two things that would let me narrow this further: your state, and whether the goal is learning robotics or making this specific commute easier. Either way, the 2012 and the $300 budget stay on the small-robot side of the line.
