import { useEffect, useMemo, useRef, useState } from "react";

export default function RoadsideAssistanceWebsite() {
  const [payClicks, setPayClicks] = useState(0);
  const [selectedService, setSelectedService] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [routeMiles, setRouteMiles] = useState<number | null>(null);
  const [routeStatus, setRouteStatus] = useState("Enter customer address to calculate route mileage");
  const [serviceBasePrice, setServiceBasePrice] = useState<number | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(18);
  const [privacyRadiusMiles, setPrivacyRadiusMiles] = useState(5);
  const [mapStage, setMapStage] = useState(0);
  const [livePosition, setLivePosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [displayPosition, setDisplayPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("Location sharing off");
  const [sharingLocation, setSharingLocation] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const squareCheckoutUrl = "https://square.link/u/GnQrUrwD";
  const mapboxToken = "";

  const services = [
    { title: "Jump Starts", desc: "Fast battery jump start service to get you moving again. ($50–$70 | After Hours $70–$90)" },
    { title: "Tire Changes", desc: "Safe roadside tire changes when you have a flat. ($60–$80 | After Hours $80–$100)" },
    { title: "Lockouts", desc: "Quick vehicle lockout assistance when your keys are inside. ($70–$100 | After Hours $90–$120)" },
    { title: "Gas Delivery", desc: "Fuel delivery to stranded drivers who run out of gas. ($60–$90 + fuel | After Hours $80–$110)" },
    { title: "Battery Changes", desc: "On-site battery replacement service to get your vehicle started again. ($80–$120+ + cost of battery | After Hours $100–$150+ + battery)" },
    { title: "Battery Testing", desc: "On-site battery testing to diagnose weak or dead batteries before replacement. ($20–$40)" },
    { title: "Tire Plug Repair", desc: "Quick tire plug repair for punctures to get you back on the road. ($25–$50 + distance | After Hours $50–$70 + distance)" },
    { title: "Lug Nut Lock Removal", desc: "Professional removal of damaged or locked lug nuts and wheel locks. Includes replacement lug nut. ($80–$120+ | After Hours $100–$150+)" },
  ];

  const bundles = [
    {
      title: "Recommended Safety Bundle",
      price: "$35–$55",
      desc: "Includes battery testing, tire pressure check, and a quick roadside safety check.",
      badge: "Recommended",
    },
    {
      title: "Emergency Priority Bundle",
      price: "$60–$95",
      desc: "Priority response plus battery and tire safety check for drivers who need faster service.",
      emergency: true,
    },
    {
      title: "Battery Care Bundle",
      price: "$50–$95",
      desc: "Battery testing plus on-site battery installation if replacement is needed.",
    },
  ];

  const isAfterHours = true;

  const serviceBasePrices: Record<string, number> = {
    "Jump Starts": 60,
    "Tire Changes": 70,
    "Lockouts": 85,
    "Gas Delivery": 75,
    "Battery Changes": 100,
    "Battery Testing": 30,
    "Tire Plug Repair": 35,
    "Lug Nut Lock Removal": 100,
    "Recommended Safety Bundle": 45,
    "Emergency Priority Bundle": 80,
    "Battery Care Bundle": 70,
  };

  const handlePayClick = () => {
    setPayClicks((prev) => prev + 1);
  };

  const startLocationSharing = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported on this device");
      return;
    }

    setSharingLocation(true);
    setLocationStatus("Requesting live location…");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLive = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setLivePosition(nextLive);
        setLocationStatus("Live ETA sharing active");

        setDisplayPosition((prev) => {
          if (prev) return prev;

          const latOffset = privacyRadiusMiles / 69;
          const lngOffset = privacyRadiusMiles / (Math.cos((nextLive.lat * Math.PI) / 180) * 69 || 69);

          return {
            lat: nextLive.lat + latOffset * 0.55,
            lng: nextLive.lng - lngOffset * 0.45,
          };
        });
      },
      (error) => {
        setSharingLocation(false);
        if (error.code === 1) setLocationStatus("Location permission denied");
        else if (error.code === 2) setLocationStatus("Unable to detect location");
        else setLocationStatus("Location request timed out");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  };

  const stopLocationSharing = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharingLocation(false);
    setLocationStatus("Location sharing paused");
  };

  const formatApproxCoords = (position: { lat: number; lng: number } | null) => {
    if (!position) return "Not shared yet";
    return `${position.lat.toFixed(3)}, ${position.lng.toFixed(3)}`;
  };

  const geocodeAddress = async (address: string) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Geocoding failed");
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error("Address not found");
    return {
      lng: feature.center[0],
      lat: feature.center[1],
      label: feature.place_name,
    };
  };

  const calculateRouteMileage = async () => {
    if (selectedService) {
      setServiceBasePrice(serviceBasePrices[selectedService] ?? 0);
    }
    if (!livePosition) {
      setRouteStatus("Turn on Share Live ETA first so route mileage can calculate from your live location");
      return;
    }
    if (!customerAddress.trim()) {
      setRouteStatus("Enter a customer address first");
      return;
    }

    try {
      setCalculatingRoute(true);
      setRouteStatus("Calculating live route mileage…");

      const destination = await geocodeAddress(customerAddress.trim());
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${livePosition.lng},${livePosition.lat};${destination.lng},${destination.lat}?access_token=${mapboxToken}&overview=false&alternatives=false&steps=false`;
      const res = await fetch(directionsUrl);
      if (!res.ok) throw new Error("Directions failed");
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) throw new Error("No route found");

      const miles = route.distance / 1609.344;
      setRouteMiles(miles);
      setDistanceMiles(miles.toFixed(1));
      setRouteStatus(`Live driving distance to ${destination.label}`);
    } catch (error: any) {
      setRouteStatus(error?.message || "Unable to calculate route mileage");
    } finally {
      setCalculatingRoute(false);
    }
  };

  useEffect(() => {
    const stages = [
      { eta: 18, radius: 5, stage: 0 },
      { eta: 14, radius: 3, stage: 1 },
      { eta: 10, radius: 2, stage: 2 },
      { eta: 6, radius: 1, stage: 3 },
    ];

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % stages.length;
      setEtaMinutes(stages[index].eta);
      setPrivacyRadiusMiles(stages[index].radius);
      setMapStage(stages[index].stage);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!livePosition) return;

    setDisplayPosition((prev) => {
      const radiusLat = privacyRadiusMiles / 69;
      const radiusLng = privacyRadiusMiles / (Math.cos((livePosition.lat * Math.PI) / 180) * 69 || 69);

      const target = {
        lat: livePosition.lat + radiusLat * 0.18 * (mapStage + 1),
        lng: livePosition.lng - radiusLng * 0.16 * (mapStage + 1),
      };

      if (!prev) return target;

      return {
        lat: prev.lat + (target.lat - prev.lat) * 0.45,
        lng: prev.lng + (target.lng - prev.lng) * 0.45,
      };
    });
  }, [livePosition, privacyRadiusMiles, mapStage]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const serviceOptions = useMemo(
    () => [...services.map((s) => s.title), ...bundles.map((b) => b.title)],
    []
  );

  const numericDistance = Number(distanceMiles || 0);
  const basePrice = selectedService ? serviceBasePrices[selectedService] ?? 0 : 0;
  const extraMiles = Math.max(0, numericDistance - 10);
  const mileageCharge = extraMiles * 3;
  const phillyFee = customerAddress.toLowerCase().includes("philadelphia") || customerAddress.toLowerCase().includes("philly") ? 25 : 0;
  const needsCustomQuote = numericDistance >= 30;
  const estimatedTotal = needsCustomQuote ? null : basePrice + mileageCharge + phillyFee;

  const selectedText = selectedService
    ? encodeURIComponent(`Hey Coop, I need ${selectedService} at ${customerAddress || "my location"}. Distance is about ${distanceMiles || "unknown"} miles. Estimated total is ${estimatedTotal !== null ? `$${estimatedTotal}` : "custom quote required"}.`)
    : encodeURIComponent(`Hey Coop I need roadside assistance at ${customerAddress || "my location"}.`);

  const isIPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const dispatchText = encodeURIComponent(
    `New job request:%0AService: ${selectedService || "Not selected"}%0ALocation: ${customerAddress || "Not provided"}%0ARoute miles: ${routeMiles ? routeMiles.toFixed(1) : distanceMiles || "Not calculated"}%0ATravel add-on: $${(mileageCharge + phillyFee).toFixed(0)}%0ABase price: $${basePrice}%0ATotal: ${estimatedTotal !== null ? `$${estimatedTotal}` : "Custom quote required"}`
  );
  const mapQuery = encodeURIComponent(customerAddress || "Dropped Pin");
  const deviceMapLink = isIPhone
    ? `https://maps.apple.com/?q=${mapQuery}`
    : `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-white">
      <div className="bg-red-600 py-2 text-center text-sm font-medium">
        {isAfterHours ? "Serving Camden right now — after-hours emergency service available" : "Serving Camden & surrounding areas — request service now"}
      </div>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950 px-6 py-4 backdrop-blur">
        <h1 className="text-xl font-bold tracking-wide">CoopersRoadside LLC</h1>
        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            Serving Camden right now
          </span>
          <a href="tel:+16094503402" className="rounded-xl bg-blue-500 px-4 py-2 font-semibold">Call Coop</a>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-center bg-cover opacity-35" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1609521263047-f8f205293f24?q=80&w=2070&auto=format&fit=crop')" }} />
        <div className={`absolute inset-0 ${isAfterHours ? "bg-gradient-to-b from-black/85 via-black/75 to-black/95" : "bg-gradient-to-b from-black/70 via-black/60 to-black/80"}`} />

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-2xl animate-pulse" />
          <div className="absolute bottom-10 right-0 h-40 w-40 rounded-full bg-amber-400/20 blur-2xl animate-pulse" />
          <div className="absolute left-1/3 top-1/4 h-24 w-24 rounded-full bg-red-500/15 blur-2xl animate-pulse" />
        </div>

        <div className="pointer-events-none absolute left-4 top-4 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_20px_rgba(252,211,77,0.9)] animate-pulse" />
        <div className="pointer-events-none absolute right-4 top-4 h-3 w-3 rounded-full bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.9)] animate-pulse" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              After Hours Emergency
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">Camden area priority service</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">100% Transparent Pricing — no hidden fees</span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">Privacy-first ETA tracking</span>
          </div>

          <h2 className="mt-4 text-4xl font-bold md:text-6xl">Fast roadside help when drivers need it most</h2>
          <p className="mt-2 text-sm text-blue-400">After Hours Pricing: 8PM – 6AM</p>
          <p className="mt-6 max-w-3xl text-lg text-slate-300">Jump starts, tire changes, lockouts, gas delivery, battery changes, battery testing, tire plug repair and lug nut lock removal.</p>
          <p className="mt-3 text-lg font-semibold text-emerald-300">If I can park a Jeep there, I can service it.</p>

          <div className="mt-8 max-w-3xl rounded-2xl border border-white/10 bg-black/30 p-4 md:p-5">
            <p className="text-sm font-semibold text-slate-200">Choose your service first</p>
            <div className="mt-3 space-y-3">
              <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white">
                <option value="">Select a service</option>
                {serviceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>

              <div className="grid gap-3 md:grid-cols-2">
                <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Customer city or address" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" />
                <input value={distanceMiles} onChange={(e) => setDistanceMiles(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Estimated miles" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" />
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={calculateRouteMileage} disabled={calculatingRoute} className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-black disabled:opacity-60">
                  {calculatingRoute ? "Calculating Route…" : "Get Live Route Mileage"}
                </button>
                <div className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">{routeStatus}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <a href={`sms:+16094503402?body=${selectedText}`} className="rounded-xl bg-blue-500 px-6 py-3 text-center font-semibold">Call / Text Coop</a>
                <a href={deviceMapLink} target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 px-6 py-3 text-center font-semibold">Drop a Pin</a>
                <a href={`sms:+16094503402?body=${dispatchText}`} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-6 py-3 text-center font-semibold text-emerald-300">Send Job Details</a>
              </div>

              {(distanceMiles || customerAddress) && (
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="font-semibold text-white">Included miles:</span> First 10 miles</p>
                    <p><span className="font-semibold text-white">Base price:</span> ${basePrice || serviceBasePrice || 0}</p>
                    <p><span className="font-semibold text-white">Mileage charge:</span> ${mileageCharge.toFixed(0)}</p>
                    <p><span className="font-semibold text-white">Philadelphia fee:</span> ${phillyFee}</p>
                    <p><span className="font-semibold text-white">Service range:</span> 30+ miles = custom quote</p>
                    <p><span className="font-semibold text-white">Route miles:</span> {routeMiles ? routeMiles.toFixed(1) : "Not calculated yet"}</p>
                    <p><span className="font-semibold text-white">Pricing source:</span> {routeMiles ? "Live map route" : "Manual estimate"}</p>
                    <p><span className="font-semibold text-white">Estimated total:</span> {estimatedTotal !== null ? `$${estimatedTotal}` : "Custom quote required"}</p>
                  </div>
                  <p className="mt-3 text-cyan-300">{needsCustomQuote ? "This trip needs a custom quote before dispatch." : `Estimated travel add-on: $${(mileageCharge + phillyFee).toFixed(0)}`}</p>
                </div>
              )}

              {selectedService && (
                <div className="flex flex-wrap gap-3">
                  <a href={squareCheckoutUrl} target="_blank" rel="noreferrer" onClick={handlePayClick} className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-black">Pay Now for {selectedService}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />Serving Camden right now</div>
          <div className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />Limited after-hours availability tonight</div>
          <div className="rounded-full bg-white px-3 py-1 text-black shadow-lg animate-pulse">Someone just booked roadside help 🔥</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Live ETA</p>
                <h2 className="mt-2 text-2xl font-bold">Approximate arrival</h2>
              </div>
              <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-black">{etaMinutes} min ETA</span>
            </div>
            <p className="mt-3 text-slate-300">Live location is intentionally approximate for safety and privacy. The displayed service position starts about 5 miles off, then tightens closer as ETA drops.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {!sharingLocation ? (
                <button onClick={startLocationSharing} className="rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black">Share Live ETA</button>
              ) : (
                <button onClick={stopLocationSharing} className="rounded-xl border border-white/20 px-4 py-3 font-semibold">Pause Sharing</button>
              )}
              <div className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">{locationStatus}</div>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950 p-4">
              <div className="relative h-56 overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                <div className="absolute left-[18%] top-[30%] h-16 w-16 rounded-full bg-cyan-400/10 blur-2xl" />
                <div className="absolute left-[58%] top-[52%] h-20 w-20 rounded-full bg-emerald-400/10 blur-2xl" />
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
                  style={{
                    left: displayPosition ? `${Math.min(82, Math.max(18, 50 + ((displayPosition.lng - (livePosition?.lng ?? displayPosition.lng)) * 900)))}%` : mapStage === 0 ? "38%" : mapStage === 1 ? "43%" : mapStage === 2 ? "46%" : "48%",
                    top: displayPosition ? `${Math.min(78, Math.max(20, 46 - ((displayPosition.lat - (livePosition?.lat ?? displayPosition.lat)) * 900)))}%` : "42%",
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className={`absolute rounded-full border border-cyan-300/40 transition-all duration-1000 ${mapStage === 0 ? "h-24 w-24" : mapStage === 1 ? "h-16 w-16" : mapStage === 2 ? "h-10 w-10" : "h-7 w-7"}`} />
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-pulse"><div className="h-2 w-2 rounded-full bg-black" /></div>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs text-slate-200">Approximate service area only • privacy radius {privacyRadiusMiles} mi</div>
                <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs text-slate-200">Approx coords: {formatApproxCoords(displayPosition)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">How it works</p>
            <h2 className="mt-2 text-2xl font-bold">Fast contact, then secure payment</h2>
            <div className="mt-4 space-y-3 text-slate-300">
              <p>1. Select the service you need in the hero section.</p>
              <p>2. Add the customer address or city, then tap Get Live Route Mileage for actual driving distance.</p>
              <p>3. Tap Call / Text Coop so your message already includes the service.</p>
              <p>4. The Drop a Pin button automatically opens Apple Maps on iPhone and Google Maps on Android.</p>
              <p>5. Pay Now appears after you choose a service.</p>
              <p>6. Your ETA updates while the map starts about 5 miles off and tightens closer as arrival gets near.</p>
              <p>7. Live sharing uses your browser location, but customers only see the privacy-adjusted service area.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-6 text-3xl font-bold">Service Area & Distance Pricing</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold">Local Coverage</h3>
            <p className="mt-2 text-slate-300">Serving Mercer County NJ and nearby areas first.</p>
            <p className="mt-3 font-semibold text-green-400">First 10 miles included in base price</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold">Mileage Rate</h3>
            <p className="mt-2 text-slate-300">After 10 miles, travel is added to protect time and fuel.</p>
            <p className="mt-3 font-semibold text-blue-400">$3 per mile after 10 miles</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold">Philadelphia Service</h3>
            <p className="mt-2 text-slate-300">Serving Philadelphia with priority roadside assistance.</p>
            <p className="mt-3 font-semibold text-red-400">+$25 city service fee</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold">Long Distance Calls</h3>
            <p className="mt-2 text-slate-300">For longer trips, pricing is adjusted based on time and distance.</p>
            <p className="mt-3 font-semibold text-yellow-400">30+ miles = custom quote</p>
            <p className="mt-1 text-sm text-slate-400">Max service range: ~45–50 miles</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold">Auto Price Estimator</h3>
            <p className="mt-2 text-slate-300">Customers can calculate actual driving mileage from a live map route before contacting you.</p>
            <p className="mt-2 text-sm text-slate-400">Powered by Mapbox route data.</p>
            <p className="mt-3 font-semibold text-cyan-300">Built into the hero section with map API support</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold">Drop a Pin</h3>
            <p className="mt-2 text-slate-300">The map button automatically responds to the customer device.</p>
            <p className="mt-3 font-semibold text-emerald-300">iPhone = Apple Maps • Android = Google Maps</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-6 text-3xl font-bold">Recommended Packages</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {bundles.map((bundle) => (
            <div key={bundle.title} className={`rounded-2xl border p-6 ${bundle.badge ? "border-blue-400 bg-blue-500/10" : bundle.emergency ? "border-red-400 bg-red-500/10" : "border-white/10 bg-slate-900"}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">{bundle.title}</h3>
                <div className="flex gap-2">
                  {bundle.badge && <span className="rounded-full bg-blue-500 px-2 py-1 text-xs">Recommended</span>}
                  {bundle.emergency && <span className="rounded-full bg-red-500 px-2 py-1 text-xs">Emergency</span>}
                </div>
              </div>
              <p className="mt-3 text-slate-300">{bundle.desc}</p>
              <p className="mt-4 font-semibold text-blue-400">{bundle.price}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500 p-6 text-black md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold">Square Secure Checkout</p>
              <h2 className="mt-4 text-3xl font-bold">Pay online in seconds</h2>
              <p className="mt-3">Out of coverage or ready to pay for service? Use secure Square checkout right from your phone.</p>
              <p className="mt-3 text-sm">Tips are always appreciated for fast response, after-hours service, and emergency roadside help.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={squareCheckoutUrl} target="_blank" rel="noreferrer" onClick={handlePayClick} className="rounded-xl bg-black px-6 py-3 font-semibold text-white">Pay Now with Square</a>
              <a href="sms:+16094503402?body=Hey%20Coop%2C%20I%E2%80%99m%20ready%20to%20pay%20for%20roadside%20service" className="rounded-xl border border-black/20 px-6 py-3 font-semibold">Text for Invoice</a>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white">
            <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-700">Secure checkout powered by Square</div>
            <iframe title="Square Checkout" src={squareCheckoutUrl} className="h-[720px] w-full bg-white" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-700/20 bg-white p-5 text-black">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Paid already?</p>
              <h3 className="mt-2 text-xl font-bold">Send your confirmation</h3>
              <p className="mt-2 text-sm text-slate-700">After payment, text Coop your name, service, and payment confirmation so your job can be marked paid fast.</p>
              <a href="sms:+16094503402?body=Hey%20Coop%2C%20I%20just%20paid.%20My%20name%20is%20_____ %20and%20my%20service%20was%20_____" className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white">Text Paid Confirmation</a>
            </div>
            <div className="rounded-2xl border border-emerald-700/20 bg-white p-5 text-black">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Checkout Activity</p>
              <h3 className="mt-2 text-xl font-bold">Pay Now clicks this visit</h3>
              <p className="mt-2 text-4xl font-bold">{payClicks}</p>
              <p className="mt-2 text-sm text-slate-700">This lets you track how often customers tap your payment button while viewing the site.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-6 text-3xl font-bold">Out of Coverage Pricing</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {services.map((s) => (
            <div key={s.title} className="rounded-2xl border border-white/10 bg-slate-900 p-6">
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-slate-300">{s.desc}</p>
              <p className="mt-3 font-semibold text-green-400">Pay directly if not covered by motor club</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-6 text-3xl font-bold">Services</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {services.map((s) => {
            const highProfit = ["Battery Changes", "Lug Nut Lock Removal", "Tire Plug Repair"].includes(s.title);
            return (
              <div key={s.title} className={`rounded-2xl p-6 ${highProfit ? "border border-blue-400 bg-blue-500/10" : "bg-slate-900"}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  {highProfit && <span className="rounded-full bg-blue-500 px-2 py-1 text-xs">High Profit</span>}
                </div>
                <p className="mt-2 text-slate-300">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/90 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <span className="text-sm">Need help now?</span>
          <div className="flex gap-3">
            <a href="sms:+16094503402?body=Hey%20I%20need%20roadside%20assistance%20at%20my%20location" className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold">Call / Text Coop</a>
            <a href={deviceMapLink} target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold">Drop a Pin</a>
          </div>
        </div>
      </div>
    </div>
  );
}
