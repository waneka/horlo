# Watch Collection Seed Data

Seed authoring output for `scripts/seed-lineage.ts` — 100 family assignments and 52 lineage edges across 11 brands and 29 families. Placeholders follow the `__CAT__<brand>__<model>__<reference>__` / `__FAM__<brand>__<family>__` convention; resolve them via the SQL in section 3, then find-and-replace into the TypeScript file.

---

## 1. Seed Manifest

### FAMILY_ASSIGNMENTS manifest

| # | Brand | Model + Reference | Family | Why |
|---|---|---|---|---|
| 1 | Rolex | Submariner Date 126610LN | Submariner | 2020-current Sub, Cal. 3235 |
| 2 | Rolex | Submariner Date 116610LN | Submariner | 2010–2020 Cerachrom Sub |
| 3 | Rolex | Submariner Date 16610 | Submariner | 1989–2010 aluminum-bezel Sub |
| 4 | Rolex | Submariner Date 16800 | Submariner | 1979–1989 transitional sapphire Sub |
| 5 | Rolex | Submariner No-Date 124060 | Submariner | Current no-date Sub (2020-) |
| 6 | Rolex | Submariner No-Date 114060 | Submariner | 2012–2020 Cerachrom no-date |
| 7 | Rolex | Submariner No-Date 14060M | Submariner | 1999–2012 no-date Sub (COSC variant from 2007) |
| 8 | Rolex | Submariner 5513 | Submariner | 1962–1989 vintage no-date Sub |
| 9 | Rolex | Sea-Dweller 126600 | Sea-Dweller | 2017-current 43mm SD w/ Cyclops |
| 10 | Rolex | Sea-Dweller 116600 | Sea-Dweller | 2014–2017 brief maxi-case SD |
| 11 | Rolex | Sea-Dweller 16600 | Sea-Dweller | 1989–2008 sapphire-crystal SD |
| 12 | Rolex | Sea-Dweller 1665 | Sea-Dweller | 1967–1980 vintage SD (Double Red / Great White) |
| 13 | Rolex | GMT-Master II 126710BLRO | GMT-Master II | Current "Pepsi" ceramic (2018-) |
| 14 | Rolex | GMT-Master II 126710BLNR | GMT-Master II | Current "Batman" ceramic (2019-) |
| 15 | Rolex | GMT-Master II 116710LN | GMT-Master II | 2007–2019 black ceramic |
| 16 | Rolex | GMT-Master II 16710 | GMT-Master II | 1989–2007 aluminum-bezel GMT II |
| 17 | Rolex | GMT-Master 1675 | GMT-Master II | 1959–1980 vintage GMT-Master |
| 18 | Rolex | Cosmograph Daytona 126500LN | Daytona | 2023-current Cal. 4131, 60th anniv. |
| 19 | Rolex | Cosmograph Daytona 116500LN | Daytona | 2016–2023 ceramic-bezel Daytona |
| 20 | Rolex | Cosmograph Daytona 116520 | Daytona | 2000–2016 in-house Cal. 4130 |
| 21 | Rolex | Cosmograph Daytona 16520 | Daytona | 1988–2000 Zenith El Primero Daytona |
| 22 | Rolex | Cosmograph Daytona 6263 | Daytona | 1969–1987 vintage manual-wind Daytona |
| 23 | Rolex | Explorer 124270 | Explorer | 2021-current 36mm Cal. 3230 |
| 24 | Rolex | Explorer 214270 | Explorer | 2010–2021 39mm Explorer |
| 25 | Rolex | Explorer 1016 | Explorer | 1963–1989 vintage 36mm Explorer |
| 26 | Rolex | Datejust 36 126234 | Datejust | Current 36mm fluted-bezel DJ (2018-) |
| 27 | Rolex | Datejust 36 116234 | Datejust | 2005–2018 Cal. 3135 fluted-bezel DJ |
| 28 | Omega | Speedmaster Moonwatch 310.30.42.50.01.001 | Speedmaster Moonwatch | Current Master Chronometer Cal. 3861 |
| 29 | Omega | Speedmaster Moonwatch 311.30.42.30.01.005 | Speedmaster Moonwatch | 2014–2021 Cal. 1861 Hesalite |
| 30 | Omega | Speedmaster Professional 3570.50 | Speedmaster Moonwatch | 1996–2014 Cal. 1861 |
| 31 | Omega | Speedmaster Professional 3590.50 | Speedmaster Moonwatch | 1987–1996 Cal. 1861 (transitional) |
| 32 | Omega | Speedmaster Professional 145.022 | Speedmaster Moonwatch | 1968–1988 Cal. 861 |
| 33 | Omega | Speedmaster Professional 145.012 | Speedmaster Moonwatch | 1967–1969 Cal. 321 |
| 34 | Omega | Speedmaster Professional 105.012 | Speedmaster Moonwatch | 1965–1968 first "Professional"-dial |
| 35 | Omega | Speedmaster CK2998 | Speedmaster Moonwatch | 1959–1962 alpha-hands pre-pro |
| 36 | Omega | Seamaster Diver 300M 210.30.42.20.01.001 | Seamaster Diver 300M | Current wave-dial SMD300 (2018-) |
| 37 | Omega | Seamaster Diver 300M 212.30.41.20.01.003 | Seamaster Diver 300M | 2012–2018 ceramic bezel SMD300 |
| 38 | Omega | Seamaster Diver 300M 2531.80 | Seamaster Diver 300M | 1995 original Bond SMD300 (auto) |
| 39 | Omega | Seamaster Planet Ocean 215.30.44.21.01.001 | Seamaster Planet Ocean | 2016-current Cal. 8900 PO 43.5mm |
| 40 | Omega | Seamaster Planet Ocean 2200.50 | Seamaster Planet Ocean | 2005 original Planet Ocean |
| 41 | Omega | Constellation 168.005 | Constellation | 1960s "Pie-Pan" vintage Constellation |
| 42 | Omega | Constellation Globemaster 130.33.39.21.02.001 | Constellation | Modern Globemaster Master Chronometer |
| 43 | Audemars Piguet | Royal Oak Jumbo Extra-Thin 15202ST | Royal Oak | 2012–2022 faithful 39mm Jumbo reissue |
| 44 | Audemars Piguet | Royal Oak Jumbo Extra-Thin 16202ST | Royal Oak | 2022 50th-anniversary Jumbo, Cal. 7121 |
| 45 | Audemars Piguet | Royal Oak 15500ST | Royal Oak | 2019-current 41mm Selfwinding |
| 46 | Audemars Piguet | Royal Oak 15400ST | Royal Oak | 2012–2019 41mm Selfwinding |
| 47 | Audemars Piguet | Royal Oak 15300ST | Royal Oak | 2005–2012 39mm modern Selfwinding |
| 48 | Audemars Piguet | Royal Oak 14790ST | Royal Oak | 1992–2005 36mm Selfwinding |
| 49 | Audemars Piguet | Royal Oak 5402ST | Royal Oak | 1972 Genta "A-series" original Jumbo |
| 50 | Audemars Piguet | Royal Oak Offshore 25721ST | Royal Oak Offshore | 1993 Gueit "The Beast" original ROO |
| 51 | Audemars Piguet | Royal Oak Offshore 26470ST | Royal Oak Offshore | 2014 modern 42mm ROO Chronograph |
| 52 | Audemars Piguet | Royal Oak Offshore 26420SO | Royal Oak Offshore | 2021 current 43mm ROO Chronograph |
| 53 | Tudor | Black Bay 79230N | Black Bay | 41mm in-house BB (2016-) |
| 54 | Tudor | Black Bay 58 79030N | Black Bay | 39mm BB58 (2018-) |
| 55 | Tudor | Black Bay GMT 79830RB | Black Bay | 2018 in-house BB GMT, Pepsi colorway |
| 56 | Tudor | Black Bay Pro 79470 | Black Bay | 2022 fixed-bezel GMT |
| 57 | Tudor | Black Bay Chrono 79360N | Black Bay | 2017 in-house chronograph |
| 58 | Tudor | Pelagos 25600TN | Pelagos | 2015 in-house 42mm titanium diver |
| 59 | Tudor | Pelagos 39 25407N | Pelagos | 2022 39mm steel Pelagos |
| 60 | Squale | 1521 Classic 1521-026 | 1521 | '70s 50-atmos Sub-style continuation |
| 61 | Christopher Ward | C60 Trident Pro 600 C60-300 | C60 Trident | UK micro modern Sub homage (600m) |
| 62 | Christopher Ward | C60 Trident Pro 300 C60-LDP38 | C60 Trident | 38mm smaller-case C60 variant |
| 63 | Steinhart | Ocean One 39 Ocean-One-39 | Ocean | 39mm German Sub-clone diver |
| 64 | Steinhart | Ocean Vintage Military Ocean-OVM | Ocean | "MilSub" homage variant |
| 65 | Swatch | MoonSwatch Mission to the Moon SO33M100 | MoonSwatch | 2022 Bioceramic Speedy tribute (white) |
| 66 | Swatch | MoonSwatch Mission to Mars SO33A100 | MoonSwatch | 2022 red-cased Speedy tribute |
| 67 | Swatch | MoonSwatch Mission to Earth SO33G100 | MoonSwatch | 2022 brown-dial Speedy tribute |
| 68 | Longines | Legend Diver L3.674.4.50.0 | Legend Diver | 2007 44mm Skin Diver reissue |
| 69 | Longines | Legend Diver L3.774.4.50.9 | Legend Diver | 2019 42mm Legend Diver |
| 70 | Longines | Heritage Military COSD L2.832.4.53.0 | Heritage Military | 1940s parachute-regiment reissue, 40mm |
| 71 | Longines | Heritage Military 1938 L2.788.1.53.0 | Heritage Military | 1938 monopusher chronograph reissue |
| 72 | Longines | Spirit 40mm L3.810.4.53.0 | Spirit | 2020 modern pilot, COSC, 40mm |
| 73 | Longines | Spirit Zulu Time L3.812.4.63.6 | Spirit | 2022 Spirit GMT, COSC, 42mm |
| 74 | Longines | HydroConquest 39mm L3.781.4.06.6 | HydroConquest | Modern 39mm steel sport diver |
| 75 | Longines | HydroConquest 41mm L3.880.4.16.2 | HydroConquest | Modern 41mm steel sport diver |
| 76 | Seiko | Prospex SLA017 | Prospex Marinemaster | 2017 62MAS recreation, limited |
| 77 | Seiko | Prospex SLA033 | Prospex Marinemaster | 2020 6105-8110 "Willard" recreation |
| 78 | Seiko | 62MAS 6217-8001 | Prospex Marinemaster | 1965–1967 first Seiko diver |
| 79 | Seiko | 6105-8110 | Prospex Marinemaster | 1970–1977 "Captain Willard" cushion case |
| 80 | Seiko | Prospex Turtle SRP777 | Prospex Turtle | 2016 modern Turtle reissue, 44mm |
| 81 | Seiko | Prospex Turtle SRPE93 | Prospex Turtle | 2021 "mini-Turtle" 42mm |
| 82 | Seiko | 6309-7040 | Prospex Turtle | 1976–1988 vintage Turtle |
| 83 | Seiko | Prospex Sumo SPB101 | Prospex Sumo | 2019 Cal. 6R35 modern Sumo |
| 84 | Seiko | Prospex Sumo SBDC001 | Prospex Sumo | 2007 original Sumo, Cal. 6R15 |
| 85 | Seiko | 5 Sports SRPD51 | 5 Sports | 2019 5KX SKX successor |
| 86 | Seiko | 5 Sports SBSA063 | 5 Sports | Modern JDM 5KX variant |
| 87 | Seiko | SKX007 | SKX | 1996–2019 iconic 200m diver |
| 88 | Seiko | SKX009 | SKX | Pepsi-bezel SKX |
| 89 | Seiko | Alpinist SARB017 | Alpinist | 2006–2018 JDM Green Alpinist |
| 90 | Seiko | Alpinist SPB121 | Alpinist | 2020 modern Alpinist redesign |
| 91 | Grand Seiko | Snowflake SBGA211 | Heritage | 2017-current Snowflake Spring Drive |
| 92 | Grand Seiko | Snowflake SBGA011 | Heritage | 2010–2017 original Snowflake |
| 93 | Grand Seiko | 44GS Recreation SBGW253 | Heritage | 2017 manual-wind 44GS recreation |
| 94 | Grand Seiko | Hi-Beat 36000 SBGH205 | Heritage | Current Hi-Beat Cal. 9S85 |
| 95 | Grand Seiko | White Birch SLGH005 | Evolution 9 | 2021 Hi-Beat 9SA5, "Shirakaba" dial |
| 96 | Grand Seiko | Lake Suwa SLGA009 | Evolution 9 | Spring Drive Evolution 9, blue dial |
| 97 | Grand Seiko | Sport SBGA463 | Sport | "Skyflake" Spring Drive sport |
| 98 | Grand Seiko | Sport SBGN013 | Sport | 9F Quartz GMT sport, blue dial |
| 99 | Grand Seiko | Elegance SBGY007 | Elegance | 2019 Spring Drive manual, urushi dial |
| 100 | Grand Seiko | Elegance SBGM221 | Elegance | Manual-wind GMT elegance |

### LINEAGE_EDGES manifest

| # | Predecessor | Successor | Type | Note |
|---|---|---|---|---|
| 1 | Rolex Submariner 5513 | Rolex Submariner No-Date 14060M | successor | 5513 → 14060 → 14060M no-date Sub chain |
| 2 | Rolex Submariner 14060M | Rolex Submariner 114060 | successor | 2012 Cerachrom + maxi case |
| 3 | Rolex Submariner 114060 | Rolex Submariner 124060 | successor | 2020 Cal. 3230 redesign |
| 4 | Rolex Submariner 16800 | Rolex Submariner 16610 | successor | 1989 quickset date, sapphire stayed |
| 5 | Rolex Submariner 16610 | Rolex Submariner 116610LN | successor | 2010 Cerachrom bezel + maxi case |
| 6 | Rolex Submariner 116610LN | Rolex Submariner 126610LN | successor | 2020 case redesign, Cal. 3235 |
| 7 | Rolex Sea-Dweller 1665 | Rolex Sea-Dweller 16600 | successor | Modern SD line (16660 interim 1978–89) |
| 8 | Rolex Sea-Dweller 16600 | Rolex Sea-Dweller 116600 | successor | 2014 maxi case + Cerachrom |
| 9 | Rolex Sea-Dweller 116600 | Rolex Sea-Dweller 126600 | successor | 2017 to 43mm + Cyclops |
| 10 | Rolex GMT-Master 1675 | Rolex GMT-Master II 16710 | successor | 1989 GMT II w/ independent hour hand |
| 11 | Rolex GMT-Master II 16710 | Rolex GMT-Master II 116710LN | successor | 2007 Cerachrom black bezel |
| 12 | Rolex GMT-Master II 116710LN | Rolex GMT-Master II 126710BLRO | successor | 2018 new case + Pepsi return |
| 13 | Rolex Daytona 6263 | Rolex Daytona 16520 | successor | 1988 self-winding Zenith El Primero |
| 14 | Rolex Daytona 16520 | Rolex Daytona 116520 | successor | 2000 in-house Cal. 4130 |
| 15 | Rolex Daytona 116520 | Rolex Daytona 116500LN | successor | 2016 Cerachrom bezel |
| 16 | Rolex Daytona 116500LN | Rolex Daytona 126500LN | successor | 2023 Cal. 4131, 60th anniv. refresh |
| 17 | Rolex Explorer 214270 | Rolex Explorer 124270 | successor | 2021 back to 36mm, Cal. 3230 |
| 18 | Rolex Datejust 116234 | Rolex Datejust 126234 | successor | 2018 Cal. 3235 update |
| 19 | Omega Speedmaster CK2998 | Omega Speedmaster 105.012 | successor | 1965 "Professional" added (105.002/.003 interim) |
| 20 | Omega Speedmaster 105.012 | Omega Speedmaster 145.012 | successor | 1967 minor case/dial update, Cal. 321 |
| 21 | Omega Speedmaster 145.012 | Omega Speedmaster 145.022 | successor | 1969 transition to Cal. 861 |
| 22 | Omega Speedmaster 145.022 | Omega Speedmaster 3590.50 | successor | 1988 Cal. 861 → Cal. 1861 |
| 23 | Omega Speedmaster 3590.50 | Omega Speedmaster 3570.50 | successor | 1996 ref renumbering, same Cal. 1861 |
| 24 | Omega Speedmaster 3570.50 | Omega Speedmaster 311.30.42.30.01.005 | successor | 2014 modern ref format |
| 25 | Omega Speedmaster 311.30.42.30.01.005 | Omega Speedmaster 310.30.42.50.01.001 | successor | 2021 Cal. 3861 Master Chronometer |
| 26 | Omega Seamaster Diver 300M 2531.80 | Omega Seamaster Diver 300M 212.30.41.20.01.003 | successor | 2012 ceramic bezel + Cal. 8500 |
| 27 | Omega Seamaster Diver 300M 212.30.41.20.01.003 | Omega Seamaster Diver 300M 210.30.42.20.01.001 | successor | 2018 wave dial, Cal. 8800 |
| 28 | Omega Planet Ocean 2200.50 | Omega Planet Ocean 215.30.44.21.01.001 | successor | Modern Cal. 8900 redesign |
| 29 | AP Royal Oak 14790ST | AP Royal Oak 15300ST | successor | 2005 to 39mm Cal. 3120 |
| 30 | AP Royal Oak 15300ST | AP Royal Oak 15400ST | successor | 2012 to 41mm |
| 31 | AP Royal Oak 15400ST | AP Royal Oak 15500ST | successor | 2019 refreshed dial, larger date |
| 32 | AP Royal Oak Jumbo 15202ST | AP Royal Oak Jumbo 16202ST | successor | 2022 end-of-15202, new Cal. 7121 |
| 33 | AP Royal Oak 5402ST | AP Royal Oak Jumbo 15202ST | remake | 2012 faithful 39mm Jumbo reissue |
| 34 | AP Royal Oak 5402ST | AP Royal Oak Jumbo 16202ST | tribute | 2022 50th-anniversary nod to original |
| 35 | AP ROO 25721ST | AP ROO 26470ST | successor | 2014 modern 42mm ROO Chronograph |
| 36 | AP ROO 26470ST | AP ROO 26420SO | successor | 2021 43mm new-case ROO |
| 37 | Longines Legend Diver L3.674.4.50.0 | Longines Legend Diver L3.774.4.50.9 | successor | 2019 size variant 44 → 42mm |
| 38 | Seiko 62MAS 6217-8001 | Seiko Prospex SLA017 | tribute | 2017 50th-anniversary 62MAS recreation |
| 39 | Seiko 6105-8110 | Seiko Prospex SLA033 | tribute | 2020 "Captain Willard" recreation |
| 40 | Seiko 6309-7040 | Seiko Prospex Turtle SRP777 | tribute | 2016 modern Turtle (cushion-case revival) |
| 41 | Seiko SKX007 | Seiko 5 Sports SRPD51 | successor | 2019 5KX replaced discontinued SKX line |
| 42 | Seiko Prospex Sumo SBDC001 | Seiko Prospex Sumo SPB101 | successor | 2019 redesign + Cal. 6R35 |
| 43 | Grand Seiko Snowflake SBGA011 | Grand Seiko Snowflake SBGA211 | successor | 2017 dial refresh + caliber update |
| 44 | Rolex Submariner 5513 | Tudor Black Bay 79230N | homage | Vintage Sub aesthetic, modern Tudor diver |
| 45 | Rolex Submariner 5513 | Tudor Black Bay 58 79030N | homage | 39mm BB58 references vintage Sub proportions |
| 46 | Rolex Submariner 5513 | Squale 1521 | homage | '70s Sub-style 50-atmos diver |
| 47 | Rolex Submariner 5513 | Steinhart Ocean Vintage Military | homage | "MilSub"-style military Sub homage |
| 48 | Rolex Submariner 16610 | Steinhart Ocean One 39 | homage | Famously close modern Sub-clone |
| 49 | Rolex Submariner 116610LN | Christopher Ward C60 Trident Pro 600 | homage | Modern ceramic-Sub-style UK micro |
| 50 | Omega Speedmaster 311.30.42.30.01.005 | Swatch MoonSwatch Mission to the Moon | homage | Bioceramic Speedy lookalike, Swatch-branded |
| 51 | Omega Speedmaster 311.30.42.30.01.005 | Swatch MoonSwatch Mission to Mars | homage | Red-cased Speedy homage |
| 52 | Omega Speedmaster 311.30.42.30.01.005 | Swatch MoonSwatch Mission to Earth | homage | Brown-dial Speedy homage |

---

## 2. TypeScript Arrays

```ts
const FAMILY_ASSIGNMENTS: Array<{
  catalogId: string
  familyId: string
  brand: string
  model: string
}> = [
  // === Rolex Submariner family ===
  { catalogId: '__CAT__rolex__submariner-date__126610ln__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner Date 126610LN' }, // note: 2020-current Sub, Cal. 3235
  { catalogId: '__CAT__rolex__submariner-date__116610ln__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner Date 116610LN' }, // note: 2010-2020 Cerachrom Sub
  { catalogId: '__CAT__rolex__submariner-date__16610__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner Date 16610' }, // note: 1989-2010 aluminum-bezel Sub
  { catalogId: '__CAT__rolex__submariner-date__16800__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner Date 16800' }, // note: 1979-1989 transitional sapphire Sub
  { catalogId: '__CAT__rolex__submariner-no-date__124060__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner No-Date 124060' }, // note: Current no-date Sub (2020-)
  { catalogId: '__CAT__rolex__submariner-no-date__114060__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner No-Date 114060' }, // note: 2012-2020 Cerachrom no-date
  { catalogId: '__CAT__rolex__submariner-no-date__14060m__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner No-Date 14060M' }, // note: 1999-2012 no-date Sub
  { catalogId: '__CAT__rolex__submariner__5513__', familyId: '__FAM__rolex__submariner__',
    brand: 'Rolex', model: 'Submariner 5513' }, // note: 1962-1989 vintage no-date Sub

  // === Rolex Sea-Dweller family ===
  { catalogId: '__CAT__rolex__sea-dweller__126600__', familyId: '__FAM__rolex__sea-dweller__',
    brand: 'Rolex', model: 'Sea-Dweller 126600' }, // note: 2017-current 43mm SD w/ Cyclops
  { catalogId: '__CAT__rolex__sea-dweller__116600__', familyId: '__FAM__rolex__sea-dweller__',
    brand: 'Rolex', model: 'Sea-Dweller 116600' }, // note: 2014-2017 brief maxi-case SD
  { catalogId: '__CAT__rolex__sea-dweller__16600__', familyId: '__FAM__rolex__sea-dweller__',
    brand: 'Rolex', model: 'Sea-Dweller 16600' }, // note: 1989-2008 sapphire-crystal SD
  { catalogId: '__CAT__rolex__sea-dweller__1665__', familyId: '__FAM__rolex__sea-dweller__',
    brand: 'Rolex', model: 'Sea-Dweller 1665' }, // note: 1967-1980 vintage SD (Double Red)

  // === Rolex GMT-Master II family ===
  { catalogId: '__CAT__rolex__gmt-master-ii__126710blro__', familyId: '__FAM__rolex__gmt-master-ii__',
    brand: 'Rolex', model: 'GMT-Master II 126710BLRO' }, // note: Current "Pepsi" ceramic (2018-)
  { catalogId: '__CAT__rolex__gmt-master-ii__126710blnr__', familyId: '__FAM__rolex__gmt-master-ii__',
    brand: 'Rolex', model: 'GMT-Master II 126710BLNR' }, // note: Current "Batman" ceramic (2019-)
  { catalogId: '__CAT__rolex__gmt-master-ii__116710ln__', familyId: '__FAM__rolex__gmt-master-ii__',
    brand: 'Rolex', model: 'GMT-Master II 116710LN' }, // note: 2007-2019 black ceramic
  { catalogId: '__CAT__rolex__gmt-master-ii__16710__', familyId: '__FAM__rolex__gmt-master-ii__',
    brand: 'Rolex', model: 'GMT-Master II 16710' }, // note: 1989-2007 aluminum-bezel GMT II
  { catalogId: '__CAT__rolex__gmt-master__1675__', familyId: '__FAM__rolex__gmt-master-ii__',
    brand: 'Rolex', model: 'GMT-Master 1675' }, // note: 1959-1980 vintage GMT-Master

  // === Rolex Daytona family ===
  { catalogId: '__CAT__rolex__cosmograph-daytona__126500ln__', familyId: '__FAM__rolex__daytona__',
    brand: 'Rolex', model: 'Cosmograph Daytona 126500LN' }, // note: 2023-current Cal. 4131, 60th anniv.
  { catalogId: '__CAT__rolex__cosmograph-daytona__116500ln__', familyId: '__FAM__rolex__daytona__',
    brand: 'Rolex', model: 'Cosmograph Daytona 116500LN' }, // note: 2016-2023 ceramic-bezel Daytona
  { catalogId: '__CAT__rolex__cosmograph-daytona__116520__', familyId: '__FAM__rolex__daytona__',
    brand: 'Rolex', model: 'Cosmograph Daytona 116520' }, // note: 2000-2016 in-house Cal. 4130
  { catalogId: '__CAT__rolex__cosmograph-daytona__16520__', familyId: '__FAM__rolex__daytona__',
    brand: 'Rolex', model: 'Cosmograph Daytona 16520' }, // note: 1988-2000 Zenith El Primero Daytona
  { catalogId: '__CAT__rolex__cosmograph-daytona__6263__', familyId: '__FAM__rolex__daytona__',
    brand: 'Rolex', model: 'Cosmograph Daytona 6263' }, // note: 1969-1987 vintage manual-wind Daytona

  // === Rolex Explorer family ===
  { catalogId: '__CAT__rolex__explorer__124270__', familyId: '__FAM__rolex__explorer__',
    brand: 'Rolex', model: 'Explorer 124270' }, // note: 2021-current 36mm Cal. 3230
  { catalogId: '__CAT__rolex__explorer__214270__', familyId: '__FAM__rolex__explorer__',
    brand: 'Rolex', model: 'Explorer 214270' }, // note: 2010-2021 39mm Explorer
  { catalogId: '__CAT__rolex__explorer__1016__', familyId: '__FAM__rolex__explorer__',
    brand: 'Rolex', model: 'Explorer 1016' }, // note: 1963-1989 vintage 36mm Explorer

  // === Rolex Datejust family ===
  { catalogId: '__CAT__rolex__datejust-36__126234__', familyId: '__FAM__rolex__datejust__',
    brand: 'Rolex', model: 'Datejust 36 126234' }, // note: Current 36mm fluted-bezel DJ (2018-)
  { catalogId: '__CAT__rolex__datejust-36__116234__', familyId: '__FAM__rolex__datejust__',
    brand: 'Rolex', model: 'Datejust 36 116234' }, // note: 2005-2018 Cal. 3135 DJ

  // === Omega Speedmaster Moonwatch family ===
  { catalogId: '__CAT__omega__speedmaster-moonwatch__310-30-42-50-01-001__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster Moonwatch 310.30.42.50.01.001' }, // note: Current Master Chronometer Cal. 3861
  { catalogId: '__CAT__omega__speedmaster-moonwatch__311-30-42-30-01-005__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster Moonwatch 311.30.42.30.01.005' }, // note: 2014-2021 Cal. 1861 Hesalite
  { catalogId: '__CAT__omega__speedmaster-professional__3570-50__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster Professional 3570.50' }, // note: 1996-2014 Cal. 1861
  { catalogId: '__CAT__omega__speedmaster-professional__3590-50__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster Professional 3590.50' }, // note: 1987-1996 Cal. 1861 (transitional)
  { catalogId: '__CAT__omega__speedmaster-professional__145-022__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster Professional 145.022' }, // note: 1968-1988 Cal. 861
  { catalogId: '__CAT__omega__speedmaster-professional__145-012__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster Professional 145.012' }, // note: 1967-1969 Cal. 321
  { catalogId: '__CAT__omega__speedmaster-professional__105-012__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster Professional 105.012' }, // note: 1965-1968 first "Professional"-dial
  { catalogId: '__CAT__omega__speedmaster__ck2998__', familyId: '__FAM__omega__speedmaster-moonwatch__',
    brand: 'Omega', model: 'Speedmaster CK2998' }, // note: 1959-1962 alpha-hands pre-pro

  // === Omega Seamaster Diver 300M family ===
  { catalogId: '__CAT__omega__seamaster-diver-300m__210-30-42-20-01-001__', familyId: '__FAM__omega__seamaster-diver-300m__',
    brand: 'Omega', model: 'Seamaster Diver 300M 210.30.42.20.01.001' }, // note: Current wave-dial SMD300
  { catalogId: '__CAT__omega__seamaster-diver-300m__212-30-41-20-01-003__', familyId: '__FAM__omega__seamaster-diver-300m__',
    brand: 'Omega', model: 'Seamaster Diver 300M 212.30.41.20.01.003' }, // note: 2012-2018 ceramic bezel
  { catalogId: '__CAT__omega__seamaster-diver-300m__2531-80__', familyId: '__FAM__omega__seamaster-diver-300m__',
    brand: 'Omega', model: 'Seamaster Diver 300M 2531.80' }, // note: 1995 original Bond SMD300

  // === Omega Seamaster Planet Ocean family ===
  { catalogId: '__CAT__omega__seamaster-planet-ocean__215-30-44-21-01-001__', familyId: '__FAM__omega__seamaster-planet-ocean__',
    brand: 'Omega', model: 'Seamaster Planet Ocean 215.30.44.21.01.001' }, // note: 2016-current Cal. 8900 PO 43.5mm
  { catalogId: '__CAT__omega__seamaster-planet-ocean__2200-50__', familyId: '__FAM__omega__seamaster-planet-ocean__',
    brand: 'Omega', model: 'Seamaster Planet Ocean 2200.50' }, // note: 2005 original Planet Ocean

  // === Omega Constellation family ===
  { catalogId: '__CAT__omega__constellation__168-005__', familyId: '__FAM__omega__constellation__',
    brand: 'Omega', model: 'Constellation 168.005' }, // note: 1960s "Pie-Pan" vintage
  { catalogId: '__CAT__omega__constellation-globemaster__130-33-39-21-02-001__', familyId: '__FAM__omega__constellation__',
    brand: 'Omega', model: 'Constellation Globemaster 130.33.39.21.02.001' }, // note: Modern Globemaster Master Chronometer

  // === AP Royal Oak family ===
  { catalogId: '__CAT__audemars-piguet__royal-oak-jumbo-extra-thin__15202st__', familyId: '__FAM__audemars-piguet__royal-oak__',
    brand: 'Audemars Piguet', model: 'Royal Oak Jumbo Extra-Thin 15202ST' }, // note: 2012-2022 faithful Jumbo reissue
  { catalogId: '__CAT__audemars-piguet__royal-oak-jumbo-extra-thin__16202st__', familyId: '__FAM__audemars-piguet__royal-oak__',
    brand: 'Audemars Piguet', model: 'Royal Oak Jumbo Extra-Thin 16202ST' }, // note: 2022 50th-anniv. Jumbo, Cal. 7121
  { catalogId: '__CAT__audemars-piguet__royal-oak__15500st__', familyId: '__FAM__audemars-piguet__royal-oak__',
    brand: 'Audemars Piguet', model: 'Royal Oak 15500ST' }, // note: 2019-current 41mm Selfwinding
  { catalogId: '__CAT__audemars-piguet__royal-oak__15400st__', familyId: '__FAM__audemars-piguet__royal-oak__',
    brand: 'Audemars Piguet', model: 'Royal Oak 15400ST' }, // note: 2012-2019 41mm Selfwinding
  { catalogId: '__CAT__audemars-piguet__royal-oak__15300st__', familyId: '__FAM__audemars-piguet__royal-oak__',
    brand: 'Audemars Piguet', model: 'Royal Oak 15300ST' }, // note: 2005-2012 39mm modern Selfwinding
  { catalogId: '__CAT__audemars-piguet__royal-oak__14790st__', familyId: '__FAM__audemars-piguet__royal-oak__',
    brand: 'Audemars Piguet', model: 'Royal Oak 14790ST' }, // note: 1992-2005 36mm Selfwinding
  { catalogId: '__CAT__audemars-piguet__royal-oak__5402st__', familyId: '__FAM__audemars-piguet__royal-oak__',
    brand: 'Audemars Piguet', model: 'Royal Oak 5402ST' }, // note: 1972 Genta "A-series" original Jumbo

  // === AP Royal Oak Offshore family ===
  { catalogId: '__CAT__audemars-piguet__royal-oak-offshore__25721st__', familyId: '__FAM__audemars-piguet__royal-oak-offshore__',
    brand: 'Audemars Piguet', model: 'Royal Oak Offshore 25721ST' }, // note: 1993 Gueit "The Beast" original ROO
  { catalogId: '__CAT__audemars-piguet__royal-oak-offshore__26470st__', familyId: '__FAM__audemars-piguet__royal-oak-offshore__',
    brand: 'Audemars Piguet', model: 'Royal Oak Offshore 26470ST' }, // note: 2014 modern 42mm ROO Chronograph
  { catalogId: '__CAT__audemars-piguet__royal-oak-offshore__26420so__', familyId: '__FAM__audemars-piguet__royal-oak-offshore__',
    brand: 'Audemars Piguet', model: 'Royal Oak Offshore 26420SO' }, // note: 2021 current 43mm ROO Chronograph

  // === Tudor Black Bay family ===
  { catalogId: '__CAT__tudor__black-bay__79230n__', familyId: '__FAM__tudor__black-bay__',
    brand: 'Tudor', model: 'Black Bay 79230N' }, // note: 41mm in-house BB (2016-)
  { catalogId: '__CAT__tudor__black-bay-58__79030n__', familyId: '__FAM__tudor__black-bay__',
    brand: 'Tudor', model: 'Black Bay 58 79030N' }, // note: 39mm BB58 (2018-)
  { catalogId: '__CAT__tudor__black-bay-gmt__79830rb__', familyId: '__FAM__tudor__black-bay__',
    brand: 'Tudor', model: 'Black Bay GMT 79830RB' }, // note: 2018 in-house BB GMT, Pepsi
  { catalogId: '__CAT__tudor__black-bay-pro__79470__', familyId: '__FAM__tudor__black-bay__',
    brand: 'Tudor', model: 'Black Bay Pro 79470' }, // note: 2022 fixed-bezel GMT
  { catalogId: '__CAT__tudor__black-bay-chrono__79360n__', familyId: '__FAM__tudor__black-bay__',
    brand: 'Tudor', model: 'Black Bay Chrono 79360N' }, // note: 2017 in-house chronograph

  // === Tudor Pelagos family ===
  { catalogId: '__CAT__tudor__pelagos__25600tn__', familyId: '__FAM__tudor__pelagos__',
    brand: 'Tudor', model: 'Pelagos 25600TN' }, // note: 2015 in-house 42mm titanium diver
  { catalogId: '__CAT__tudor__pelagos-39__25407n__', familyId: '__FAM__tudor__pelagos__',
    brand: 'Tudor', model: 'Pelagos 39 25407N' }, // note: 2022 39mm steel Pelagos

  // === Squale 1521 family ===
  { catalogId: '__CAT__squale__1521-classic__1521-026__', familyId: '__FAM__squale__1521__',
    brand: 'Squale', model: '1521 Classic 1521-026' }, // note: '70s 50-atmos Sub-style continuation

  // === Christopher Ward C60 Trident family ===
  { catalogId: '__CAT__christopher-ward__c60-trident-pro-600__c60-300__', familyId: '__FAM__christopher-ward__c60-trident__',
    brand: 'Christopher Ward', model: 'C60 Trident Pro 600 C60-300' }, // note: UK micro modern Sub homage (600m)
  { catalogId: '__CAT__christopher-ward__c60-trident-pro-300__c60-ldp38__', familyId: '__FAM__christopher-ward__c60-trident__',
    brand: 'Christopher Ward', model: 'C60 Trident Pro 300 C60-LDP38' }, // note: 38mm smaller-case C60 variant

  // === Steinhart Ocean family ===
  { catalogId: '__CAT__steinhart__ocean-one-39__ocean-one-39__', familyId: '__FAM__steinhart__ocean__',
    brand: 'Steinhart', model: 'Ocean One 39 Ocean-One-39' }, // note: 39mm German Sub-clone diver
  { catalogId: '__CAT__steinhart__ocean-vintage-military__ocean-ovm__', familyId: '__FAM__steinhart__ocean__',
    brand: 'Steinhart', model: 'Ocean Vintage Military Ocean-OVM' }, // note: "MilSub" homage variant

  // === Swatch MoonSwatch family ===
  { catalogId: '__CAT__swatch__moonswatch-mission-to-the-moon__so33m100__', familyId: '__FAM__swatch__moonswatch__',
    brand: 'Swatch', model: 'MoonSwatch Mission to the Moon SO33M100' }, // note: 2022 Bioceramic Speedy tribute (white)
  { catalogId: '__CAT__swatch__moonswatch-mission-to-mars__so33a100__', familyId: '__FAM__swatch__moonswatch__',
    brand: 'Swatch', model: 'MoonSwatch Mission to Mars SO33A100' }, // note: 2022 red-cased Speedy tribute
  { catalogId: '__CAT__swatch__moonswatch-mission-to-earth__so33g100__', familyId: '__FAM__swatch__moonswatch__',
    brand: 'Swatch', model: 'MoonSwatch Mission to Earth SO33G100' }, // note: 2022 brown-dial Speedy tribute

  // === Longines Legend Diver family ===
  { catalogId: '__CAT__longines__legend-diver__l3-674-4-50-0__', familyId: '__FAM__longines__legend-diver__',
    brand: 'Longines', model: 'Legend Diver L3.674.4.50.0' }, // note: 2007 44mm Skin Diver reissue
  { catalogId: '__CAT__longines__legend-diver__l3-774-4-50-9__', familyId: '__FAM__longines__legend-diver__',
    brand: 'Longines', model: 'Legend Diver L3.774.4.50.9' }, // note: 2019 42mm Legend Diver

  // === Longines Heritage Military family ===
  { catalogId: '__CAT__longines__heritage-military-cosd__l2-832-4-53-0__', familyId: '__FAM__longines__heritage-military__',
    brand: 'Longines', model: 'Heritage Military COSD L2.832.4.53.0' }, // note: 1940s parachute-regiment reissue
  { catalogId: '__CAT__longines__heritage-military-1938__l2-788-1-53-0__', familyId: '__FAM__longines__heritage-military__',
    brand: 'Longines', model: 'Heritage Military 1938 L2.788.1.53.0' }, // note: 1938 monopusher chrono reissue

  // === Longines Spirit family ===
  { catalogId: '__CAT__longines__spirit__l3-810-4-53-0__', familyId: '__FAM__longines__spirit__',
    brand: 'Longines', model: 'Spirit 40mm L3.810.4.53.0' }, // note: 2020 modern pilot, COSC, 40mm
  { catalogId: '__CAT__longines__spirit-zulu-time__l3-812-4-63-6__', familyId: '__FAM__longines__spirit__',
    brand: 'Longines', model: 'Spirit Zulu Time L3.812.4.63.6' }, // note: 2022 Spirit GMT, COSC, 42mm

  // === Longines HydroConquest family ===
  { catalogId: '__CAT__longines__hydroconquest-39__l3-781-4-06-6__', familyId: '__FAM__longines__hydroconquest__',
    brand: 'Longines', model: 'HydroConquest 39mm L3.781.4.06.6' }, // note: Modern 39mm steel sport diver
  { catalogId: '__CAT__longines__hydroconquest-41__l3-880-4-16-2__', familyId: '__FAM__longines__hydroconquest__',
    brand: 'Longines', model: 'HydroConquest 41mm L3.880.4.16.2' }, // note: Modern 41mm steel sport diver

  // === Seiko Prospex Marinemaster family ===
  { catalogId: '__CAT__seiko__prospex-sla017__sla017__', familyId: '__FAM__seiko__prospex-marinemaster__',
    brand: 'Seiko', model: 'Prospex SLA017' }, // note: 2017 62MAS recreation, limited
  { catalogId: '__CAT__seiko__prospex-sla033__sla033__', familyId: '__FAM__seiko__prospex-marinemaster__',
    brand: 'Seiko', model: 'Prospex SLA033' }, // note: 2020 6105-8110 "Willard" recreation
  { catalogId: '__CAT__seiko__62mas__6217-8001__', familyId: '__FAM__seiko__prospex-marinemaster__',
    brand: 'Seiko', model: '62MAS 6217-8001' }, // note: 1965-1967 first Seiko diver
  { catalogId: '__CAT__seiko__6105__6105-8110__', familyId: '__FAM__seiko__prospex-marinemaster__',
    brand: 'Seiko', model: '6105-8110' }, // note: 1970-1977 "Captain Willard" cushion case

  // === Seiko Prospex Turtle family ===
  { catalogId: '__CAT__seiko__prospex-turtle__srp777__', familyId: '__FAM__seiko__prospex-turtle__',
    brand: 'Seiko', model: 'Prospex Turtle SRP777' }, // note: 2016 modern Turtle reissue, 44mm
  { catalogId: '__CAT__seiko__prospex-turtle__srpe93__', familyId: '__FAM__seiko__prospex-turtle__',
    brand: 'Seiko', model: 'Prospex Turtle SRPE93' }, // note: 2021 "mini-Turtle" 42mm
  { catalogId: '__CAT__seiko__turtle__6309-7040__', familyId: '__FAM__seiko__prospex-turtle__',
    brand: 'Seiko', model: '6309-7040' }, // note: 1976-1988 vintage Turtle

  // === Seiko Prospex Sumo family ===
  { catalogId: '__CAT__seiko__prospex-sumo__spb101__', familyId: '__FAM__seiko__prospex-sumo__',
    brand: 'Seiko', model: 'Prospex Sumo SPB101' }, // note: 2019 Cal. 6R35 modern Sumo
  { catalogId: '__CAT__seiko__prospex-sumo__sbdc001__', familyId: '__FAM__seiko__prospex-sumo__',
    brand: 'Seiko', model: 'Prospex Sumo SBDC001' }, // note: 2007 original Sumo, Cal. 6R15

  // === Seiko 5 Sports family ===
  { catalogId: '__CAT__seiko__5-sports__srpd51__', familyId: '__FAM__seiko__5-sports__',
    brand: 'Seiko', model: '5 Sports SRPD51' }, // note: 2019 5KX SKX successor
  { catalogId: '__CAT__seiko__5-sports__sbsa063__', familyId: '__FAM__seiko__5-sports__',
    brand: 'Seiko', model: '5 Sports SBSA063' }, // note: Modern JDM 5KX variant

  // === Seiko SKX family ===
  { catalogId: '__CAT__seiko__skx__skx007__', familyId: '__FAM__seiko__skx__',
    brand: 'Seiko', model: 'SKX007' }, // note: 1996-2019 iconic 200m diver
  { catalogId: '__CAT__seiko__skx__skx009__', familyId: '__FAM__seiko__skx__',
    brand: 'Seiko', model: 'SKX009' }, // note: Pepsi-bezel SKX

  // === Seiko Alpinist family ===
  { catalogId: '__CAT__seiko__alpinist__sarb017__', familyId: '__FAM__seiko__alpinist__',
    brand: 'Seiko', model: 'Alpinist SARB017' }, // note: 2006-2018 JDM Green Alpinist
  { catalogId: '__CAT__seiko__alpinist__spb121__', familyId: '__FAM__seiko__alpinist__',
    brand: 'Seiko', model: 'Alpinist SPB121' }, // note: 2020 modern Alpinist redesign

  // === Grand Seiko Heritage family ===
  { catalogId: '__CAT__grand-seiko__heritage-snowflake__sbga211__', familyId: '__FAM__grand-seiko__heritage__',
    brand: 'Grand Seiko', model: 'Snowflake SBGA211' }, // note: 2017-current Snowflake Spring Drive
  { catalogId: '__CAT__grand-seiko__heritage-snowflake__sbga011__', familyId: '__FAM__grand-seiko__heritage__',
    brand: 'Grand Seiko', model: 'Snowflake SBGA011' }, // note: 2010-2017 original Snowflake
  { catalogId: '__CAT__grand-seiko__heritage-44gs__sbgw253__', familyId: '__FAM__grand-seiko__heritage__',
    brand: 'Grand Seiko', model: '44GS Recreation SBGW253' }, // note: 2017 manual-wind 44GS recreation
  { catalogId: '__CAT__grand-seiko__heritage-hi-beat__sbgh205__', familyId: '__FAM__grand-seiko__heritage__',
    brand: 'Grand Seiko', model: 'Hi-Beat 36000 SBGH205' }, // note: Current Hi-Beat Cal. 9S85

  // === Grand Seiko Evolution 9 family ===
  { catalogId: '__CAT__grand-seiko__evolution-9-white-birch__slgh005__', familyId: '__FAM__grand-seiko__evolution-9__',
    brand: 'Grand Seiko', model: 'White Birch SLGH005' }, // note: 2021 Hi-Beat 9SA5, Shirakaba dial
  { catalogId: '__CAT__grand-seiko__evolution-9-lake-suwa__slga009__', familyId: '__FAM__grand-seiko__evolution-9__',
    brand: 'Grand Seiko', model: 'Lake Suwa SLGA009' }, // note: Spring Drive Evolution 9, blue dial

  // === Grand Seiko Sport family ===
  { catalogId: '__CAT__grand-seiko__sport__sbga463__', familyId: '__FAM__grand-seiko__sport__',
    brand: 'Grand Seiko', model: 'Sport SBGA463' }, // note: "Skyflake" Spring Drive sport
  { catalogId: '__CAT__grand-seiko__sport__sbgn013__', familyId: '__FAM__grand-seiko__sport__',
    brand: 'Grand Seiko', model: 'Sport SBGN013' }, // note: 9F Quartz GMT sport, blue dial

  // === Grand Seiko Elegance family ===
  { catalogId: '__CAT__grand-seiko__elegance__sbgy007__', familyId: '__FAM__grand-seiko__elegance__',
    brand: 'Grand Seiko', model: 'Elegance SBGY007' }, // note: 2019 Spring Drive manual, urushi dial
  { catalogId: '__CAT__grand-seiko__elegance__sbgm221__', familyId: '__FAM__grand-seiko__elegance__',
    brand: 'Grand Seiko', model: 'Elegance SBGM221' }, // note: Manual-wind GMT elegance
]
```

```ts
const LINEAGE_EDGES: Array<{
  predecessorCatalogId: string
  successorCatalogId: string
  relationshipType: 'predecessor' | 'successor' | 'remake' | 'tribute' | 'homage'
  note?: string
}> = [
  // === Rolex Submariner same-line successors ===
  { predecessorCatalogId: '__CAT__rolex__submariner__5513__',
    successorCatalogId:   '__CAT__rolex__submariner-no-date__14060m__',
    relationshipType: 'successor',
    note: '5513 → 14060 → 14060M no-date Sub chain (1989 transition)' },
  { predecessorCatalogId: '__CAT__rolex__submariner-no-date__14060m__',
    successorCatalogId:   '__CAT__rolex__submariner-no-date__114060__',
    relationshipType: 'successor',
    note: '14060M → 114060 (2012 Cerachrom + maxi case)' },
  { predecessorCatalogId: '__CAT__rolex__submariner-no-date__114060__',
    successorCatalogId:   '__CAT__rolex__submariner-no-date__124060__',
    relationshipType: 'successor',
    note: '114060 → 124060 (2020 Cal. 3230 redesign)' },
  { predecessorCatalogId: '__CAT__rolex__submariner-date__16800__',
    successorCatalogId:   '__CAT__rolex__submariner-date__16610__',
    relationshipType: 'successor',
    note: '16800 → 16610 (1989 quickset date, sapphire stayed)' },
  { predecessorCatalogId: '__CAT__rolex__submariner-date__16610__',
    successorCatalogId:   '__CAT__rolex__submariner-date__116610ln__',
    relationshipType: 'successor',
    note: '16610 → 116610LN (2010 Cerachrom bezel + maxi case)' },
  { predecessorCatalogId: '__CAT__rolex__submariner-date__116610ln__',
    successorCatalogId:   '__CAT__rolex__submariner-date__126610ln__',
    relationshipType: 'successor',
    note: '116610LN → 126610LN (2020 case redesign, Cal. 3235)' },

  // === Sea-Dweller same-line successors ===
  { predecessorCatalogId: '__CAT__rolex__sea-dweller__1665__',
    successorCatalogId:   '__CAT__rolex__sea-dweller__16600__',
    relationshipType: 'successor',
    note: '1665 → 16600 (modern SD line; 16660 interim 1978-89)' },
  { predecessorCatalogId: '__CAT__rolex__sea-dweller__16600__',
    successorCatalogId:   '__CAT__rolex__sea-dweller__116600__',
    relationshipType: 'successor',
    note: '16600 → 116600 (2014 maxi case + Cerachrom)' },
  { predecessorCatalogId: '__CAT__rolex__sea-dweller__116600__',
    successorCatalogId:   '__CAT__rolex__sea-dweller__126600__',
    relationshipType: 'successor',
    note: '116600 → 126600 (2017 to 43mm + Cyclops)' },

  // === GMT-Master II same-line successors ===
  { predecessorCatalogId: '__CAT__rolex__gmt-master__1675__',
    successorCatalogId:   '__CAT__rolex__gmt-master-ii__16710__',
    relationshipType: 'successor',
    note: '1675 → 16710 (1989 GMT II with independent hour hand)' },
  { predecessorCatalogId: '__CAT__rolex__gmt-master-ii__16710__',
    successorCatalogId:   '__CAT__rolex__gmt-master-ii__116710ln__',
    relationshipType: 'successor',
    note: '16710 → 116710LN (2007 Cerachrom black bezel)' },
  { predecessorCatalogId: '__CAT__rolex__gmt-master-ii__116710ln__',
    successorCatalogId:   '__CAT__rolex__gmt-master-ii__126710blro__',
    relationshipType: 'successor',
    note: '116710LN → 126710BLRO (2018 new case + Pepsi return in steel)' },

  // === Daytona same-line successors ===
  { predecessorCatalogId: '__CAT__rolex__cosmograph-daytona__6263__',
    successorCatalogId:   '__CAT__rolex__cosmograph-daytona__16520__',
    relationshipType: 'successor',
    note: '6263 → 16520 (1988 self-winding Zenith El Primero)' },
  { predecessorCatalogId: '__CAT__rolex__cosmograph-daytona__16520__',
    successorCatalogId:   '__CAT__rolex__cosmograph-daytona__116520__',
    relationshipType: 'successor',
    note: '16520 → 116520 (2000 in-house Cal. 4130)' },
  { predecessorCatalogId: '__CAT__rolex__cosmograph-daytona__116520__',
    successorCatalogId:   '__CAT__rolex__cosmograph-daytona__116500ln__',
    relationshipType: 'successor',
    note: '116520 → 116500LN (2016 Cerachrom bezel)' },
  { predecessorCatalogId: '__CAT__rolex__cosmograph-daytona__116500ln__',
    successorCatalogId:   '__CAT__rolex__cosmograph-daytona__126500ln__',
    relationshipType: 'successor',
    note: '116500LN → 126500LN (2023 Cal. 4131, 60th anniv. refresh)' },

  // === Explorer & Datejust successors ===
  { predecessorCatalogId: '__CAT__rolex__explorer__214270__',
    successorCatalogId:   '__CAT__rolex__explorer__124270__',
    relationshipType: 'successor',
    note: '214270 → 124270 (2021 back to 36mm, Cal. 3230)' },
  { predecessorCatalogId: '__CAT__rolex__datejust-36__116234__',
    successorCatalogId:   '__CAT__rolex__datejust-36__126234__',
    relationshipType: 'successor',
    note: '116234 → 126234 (2018 Cal. 3235 update)' },

  // === Omega Speedmaster Moonwatch successors ===
  { predecessorCatalogId: '__CAT__omega__speedmaster__ck2998__',
    successorCatalogId:   '__CAT__omega__speedmaster-professional__105-012__',
    relationshipType: 'successor',
    note: 'CK2998 → 105.012 (1965 "Professional" dial; 105.002/.003 interim)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-professional__105-012__',
    successorCatalogId:   '__CAT__omega__speedmaster-professional__145-012__',
    relationshipType: 'successor',
    note: '105.012 → 145.012 (1967 minor update, Cal. 321)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-professional__145-012__',
    successorCatalogId:   '__CAT__omega__speedmaster-professional__145-022__',
    relationshipType: 'successor',
    note: '145.012 → 145.022 (1969 transition to Cal. 861)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-professional__145-022__',
    successorCatalogId:   '__CAT__omega__speedmaster-professional__3590-50__',
    relationshipType: 'successor',
    note: '145.022 → 3590.50 (1988 Cal. 861 → Cal. 1861)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-professional__3590-50__',
    successorCatalogId:   '__CAT__omega__speedmaster-professional__3570-50__',
    relationshipType: 'successor',
    note: '3590.50 → 3570.50 (1996 ref renumbering)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-professional__3570-50__',
    successorCatalogId:   '__CAT__omega__speedmaster-moonwatch__311-30-42-30-01-005__',
    relationshipType: 'successor',
    note: '3570.50 → 311.30.42.30.01.005 (2014 modern ref format)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-moonwatch__311-30-42-30-01-005__',
    successorCatalogId:   '__CAT__omega__speedmaster-moonwatch__310-30-42-50-01-001__',
    relationshipType: 'successor',
    note: '311 → 310 (2021 Cal. 3861 Master Chronometer)' },

  // === Omega Seamaster successors ===
  { predecessorCatalogId: '__CAT__omega__seamaster-diver-300m__2531-80__',
    successorCatalogId:   '__CAT__omega__seamaster-diver-300m__212-30-41-20-01-003__',
    relationshipType: 'successor',
    note: '2531.80 → 212.30.41.20.01.003 (2012 ceramic bezel + Cal. 8500)' },
  { predecessorCatalogId: '__CAT__omega__seamaster-diver-300m__212-30-41-20-01-003__',
    successorCatalogId:   '__CAT__omega__seamaster-diver-300m__210-30-42-20-01-001__',
    relationshipType: 'successor',
    note: '212 → 210 (2018 wave dial, Cal. 8800)' },
  { predecessorCatalogId: '__CAT__omega__seamaster-planet-ocean__2200-50__',
    successorCatalogId:   '__CAT__omega__seamaster-planet-ocean__215-30-44-21-01-001__',
    relationshipType: 'successor',
    note: '2200.50 → 215.30.44.21.01.001 (Cal. 8900 redesign)' },

  // === AP Royal Oak successors / remake / tribute ===
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak__14790st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak__15300st__',
    relationshipType: 'successor',
    note: '14790ST → 15300ST (2005 to 39mm Cal. 3120)' },
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak__15300st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak__15400st__',
    relationshipType: 'successor',
    note: '15300ST → 15400ST (2012 to 41mm)' },
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak__15400st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak__15500st__',
    relationshipType: 'successor',
    note: '15400ST → 15500ST (2019 refreshed dial, larger date)' },
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak-jumbo-extra-thin__15202st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak-jumbo-extra-thin__16202st__',
    relationshipType: 'successor',
    note: '15202ST → 16202ST (2022 end-of-15202 production, Cal. 7121)' },
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak__5402st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak-jumbo-extra-thin__15202st__',
    relationshipType: 'remake',
    note: '5402ST → 15202ST (2012 faithful 39mm Jumbo reissue, 40th anniv.)' },
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak__5402st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak-jumbo-extra-thin__16202st__',
    relationshipType: 'tribute',
    note: '5402ST → 16202ST (2022 50th-anniversary nod to original)' },

  // === AP Royal Oak Offshore successors ===
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak-offshore__25721st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak-offshore__26470st__',
    relationshipType: 'successor',
    note: '25721ST → 26470ST (2014 modern 42mm ROO Chronograph)' },
  { predecessorCatalogId: '__CAT__audemars-piguet__royal-oak-offshore__26470st__',
    successorCatalogId:   '__CAT__audemars-piguet__royal-oak-offshore__26420so__',
    relationshipType: 'successor',
    note: '26470ST → 26420SO (2021 43mm new-case ROO)' },

  // === Longines, Seiko, GS same-line successors ===
  { predecessorCatalogId: '__CAT__longines__legend-diver__l3-674-4-50-0__',
    successorCatalogId:   '__CAT__longines__legend-diver__l3-774-4-50-9__',
    relationshipType: 'successor',
    note: 'L3.674 → L3.774 (2019 44mm → 42mm Legend Diver variant)' },
  { predecessorCatalogId: '__CAT__seiko__skx__skx007__',
    successorCatalogId:   '__CAT__seiko__5-sports__srpd51__',
    relationshipType: 'successor',
    note: 'SKX007 → SRPD51 (2019 5KX replaced discontinued SKX line)' },
  { predecessorCatalogId: '__CAT__seiko__prospex-sumo__sbdc001__',
    successorCatalogId:   '__CAT__seiko__prospex-sumo__spb101__',
    relationshipType: 'successor',
    note: 'SBDC001 → SPB101 (2019 redesign + Cal. 6R35)' },
  { predecessorCatalogId: '__CAT__grand-seiko__heritage-snowflake__sbga011__',
    successorCatalogId:   '__CAT__grand-seiko__heritage-snowflake__sbga211__',
    relationshipType: 'successor',
    note: 'SBGA011 → SBGA211 (2017 Snowflake dial refresh + caliber update)' },

  // === Seiko same-brand tributes (vintage → modern recreation) ===
  { predecessorCatalogId: '__CAT__seiko__62mas__6217-8001__',
    successorCatalogId:   '__CAT__seiko__prospex-sla017__sla017__',
    relationshipType: 'tribute',
    note: '6217-8001 → SLA017 (2017 50th-anniversary 62MAS recreation)' },
  { predecessorCatalogId: '__CAT__seiko__6105__6105-8110__',
    successorCatalogId:   '__CAT__seiko__prospex-sla033__sla033__',
    relationshipType: 'tribute',
    note: '6105-8110 → SLA033 (2020 "Captain Willard" recreation)' },
  { predecessorCatalogId: '__CAT__seiko__turtle__6309-7040__',
    successorCatalogId:   '__CAT__seiko__prospex-turtle__srp777__',
    relationshipType: 'tribute',
    note: '6309-7040 → SRP777 (2016 modern Turtle, cushion-case revival)' },

  // === Cross-brand homages: Submariner ===
  { predecessorCatalogId: '__CAT__rolex__submariner__5513__',
    successorCatalogId:   '__CAT__tudor__black-bay__79230n__',
    relationshipType: 'homage',
    note: '5513 → Black Bay 79230N (vintage Sub aesthetic, modern Tudor diver)' },
  { predecessorCatalogId: '__CAT__rolex__submariner__5513__',
    successorCatalogId:   '__CAT__tudor__black-bay-58__79030n__',
    relationshipType: 'homage',
    note: '5513 → BB58 79030N (39mm proportions reference vintage Sub)' },
  { predecessorCatalogId: '__CAT__rolex__submariner__5513__',
    successorCatalogId:   '__CAT__squale__1521-classic__1521-026__',
    relationshipType: 'homage',
    note: '5513 → Squale 1521 (period-correct \'70s Sub-style diver)' },
  { predecessorCatalogId: '__CAT__rolex__submariner__5513__',
    successorCatalogId:   '__CAT__steinhart__ocean-vintage-military__ocean-ovm__',
    relationshipType: 'homage',
    note: '5513 → Steinhart OVM (MilSub-style military Sub homage)' },
  { predecessorCatalogId: '__CAT__rolex__submariner-date__16610__',
    successorCatalogId:   '__CAT__steinhart__ocean-one-39__ocean-one-39__',
    relationshipType: 'homage',
    note: '16610 → Ocean One 39 (famously close modern Sub-clone)' },
  { predecessorCatalogId: '__CAT__rolex__submariner-date__116610ln__',
    successorCatalogId:   '__CAT__christopher-ward__c60-trident-pro-600__c60-300__',
    relationshipType: 'homage',
    note: '116610LN → C60 Trident (modern ceramic-Sub-style UK micro)' },

  // === Cross-brand homages: Speedmaster ===
  { predecessorCatalogId: '__CAT__omega__speedmaster-moonwatch__311-30-42-30-01-005__',
    successorCatalogId:   '__CAT__swatch__moonswatch-mission-to-the-moon__so33m100__',
    relationshipType: 'homage',
    note: '311 → MoonSwatch Mission to the Moon (Bioceramic Speedy lookalike)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-moonwatch__311-30-42-30-01-005__',
    successorCatalogId:   '__CAT__swatch__moonswatch-mission-to-mars__so33a100__',
    relationshipType: 'homage',
    note: '311 → MoonSwatch Mission to Mars (red-cased Speedy homage)' },
  { predecessorCatalogId: '__CAT__omega__speedmaster-moonwatch__311-30-42-30-01-005__',
    successorCatalogId:   '__CAT__swatch__moonswatch-mission-to-earth__so33g100__',
    relationshipType: 'homage',
    note: '311 → MoonSwatch Mission to Earth (brown-dial Speedy homage)' },
]
```

---

## 3. Placeholder Resolution SQL

```sql
-- ============================================================
-- Result set 1: catalog UUID mapping (100 references)
-- IN-clause form is logically identical to the prompt's example
-- "(brand ILIKE 'X' AND reference = 'Y') OR ..." but compact.
-- ============================================================
SELECT
  '__CAT__' || lower(regexp_replace(brand, '[^a-zA-Z0-9]+', '-', 'g'))
            || '__' || lower(regexp_replace(model, '[^a-zA-Z0-9]+', '-', 'g'))
            || '__' || lower(regexp_replace(reference, '[^a-zA-Z0-9]+', '-', 'g'))
            || '__'           AS placeholder,
  id                          AS uuid,
  brand, model, reference, family_id
FROM watches_catalog
WHERE
  (brand ILIKE 'Rolex' AND reference IN (
    -- Submariner
    '126610LN','116610LN','16610','16800','124060','114060','14060M','5513',
    -- Sea-Dweller
    '126600','116600','16600','1665',
    -- GMT-Master II / GMT-Master
    '126710BLRO','126710BLNR','116710LN','16710','1675',
    -- Daytona
    '126500LN','116500LN','116520','16520','6263',
    -- Explorer
    '124270','214270','1016',
    -- Datejust
    '126234','116234'
  )) OR
  (brand ILIKE 'Omega' AND reference IN (
    -- Speedmaster Moonwatch
    '310.30.42.50.01.001','311.30.42.30.01.005','3570.50','3590.50',
    '145.022','145.012','105.012','CK2998',
    -- Seamaster Diver 300M
    '210.30.42.20.01.001','212.30.41.20.01.003','2531.80',
    -- Seamaster Planet Ocean
    '215.30.44.21.01.001','2200.50',
    -- Constellation
    '168.005','130.33.39.21.02.001'
  )) OR
  (brand ILIKE 'Audemars Piguet' AND reference IN (
    -- Royal Oak
    '15202ST','16202ST','15500ST','15400ST','15300ST','14790ST','5402ST',
    -- Royal Oak Offshore
    '25721ST','26470ST','26420SO'
  )) OR
  (brand ILIKE 'Tudor' AND reference IN (
    -- Black Bay
    '79230N','79030N','79830RB','79470','79360N',
    -- Pelagos
    '25600TN','25407N'
  )) OR
  (brand ILIKE 'Squale'           AND reference = '1521-026') OR
  (brand ILIKE 'Christopher Ward' AND reference IN ('C60-300','C60-LDP38')) OR
  (brand ILIKE 'Steinhart'        AND reference IN ('Ocean-One-39','Ocean-OVM')) OR
  (brand ILIKE 'Swatch'           AND reference IN ('SO33M100','SO33A100','SO33G100')) OR
  (brand ILIKE 'Longines' AND reference IN (
    -- Legend Diver
    'L3.674.4.50.0','L3.774.4.50.9',
    -- Heritage Military
    'L2.832.4.53.0','L2.788.1.53.0',
    -- Spirit
    'L3.810.4.53.0','L3.812.4.63.6',
    -- HydroConquest
    'L3.781.4.06.6','L3.880.4.16.2'
  )) OR
  (brand ILIKE 'Seiko' AND reference IN (
    -- Prospex Marinemaster
    'SLA017','SLA033','6217-8001','6105-8110',
    -- Prospex Turtle
    'SRP777','SRPE93','6309-7040',
    -- Prospex Sumo
    'SPB101','SBDC001',
    -- 5 Sports
    'SRPD51','SBSA063',
    -- SKX
    'SKX007','SKX009',
    -- Alpinist
    'SARB017','SPB121'
  )) OR
  (brand ILIKE 'Grand Seiko' AND reference IN (
    -- Heritage
    'SBGA211','SBGA011','SBGW253','SBGH205',
    -- Evolution 9
    'SLGH005','SLGA009',
    -- Sport
    'SBGA463','SBGN013',
    -- Elegance
    'SBGY007','SBGM221'
  ))
ORDER BY placeholder;

-- ============================================================
-- Result set 2: family UUID mapping (29 families across 11 brands)
-- ============================================================
SELECT
  '__FAM__' || lower(regexp_replace(b.name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '__' || lower(regexp_replace(wf.name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '__'           AS placeholder,
  wf.id                       AS uuid,
  b.name AS brand, wf.name AS family
FROM watch_families wf
JOIN brands b ON b.id = wf.brand_id
WHERE
  (b.name = 'Rolex'            AND wf.name ILIKE 'Submariner%')            OR
  (b.name = 'Rolex'            AND wf.name ILIKE 'Sea-Dweller%')           OR
  (b.name = 'Rolex'            AND wf.name ILIKE 'GMT-Master II%')         OR
  (b.name = 'Rolex'            AND wf.name ILIKE 'Daytona%')               OR
  (b.name = 'Rolex'            AND wf.name ILIKE 'Explorer%')              OR
  (b.name = 'Rolex'            AND wf.name ILIKE 'Datejust%')              OR
  (b.name = 'Omega'            AND wf.name ILIKE 'Speedmaster Moonwatch%') OR
  (b.name = 'Omega'            AND wf.name ILIKE 'Seamaster Diver 300M%') OR
  (b.name = 'Omega'            AND wf.name ILIKE 'Seamaster Planet Ocean%') OR
  (b.name = 'Omega'            AND wf.name ILIKE 'Constellation%')         OR
  (b.name = 'Audemars Piguet'  AND wf.name ILIKE 'Royal Oak%')             OR
  (b.name = 'Audemars Piguet'  AND wf.name ILIKE 'Royal Oak Offshore%')    OR
  (b.name = 'Tudor'            AND wf.name ILIKE 'Black Bay%')             OR
  (b.name = 'Tudor'            AND wf.name ILIKE 'Pelagos%')               OR
  (b.name = 'Squale'           AND wf.name ILIKE '1521%')                  OR
  (b.name = 'Christopher Ward' AND wf.name ILIKE 'C60%')                   OR
  (b.name = 'Steinhart'        AND wf.name ILIKE 'Ocean%')                 OR
  (b.name = 'Swatch'           AND wf.name ILIKE 'MoonSwatch%')            OR
  (b.name = 'Longines'         AND wf.name ILIKE 'Legend Diver%')          OR
  (b.name = 'Longines'         AND wf.name ILIKE 'Heritage Military%')     OR
  (b.name = 'Longines'         AND wf.name ILIKE 'Spirit%')                OR
  (b.name = 'Longines'         AND wf.name ILIKE 'HydroConquest%')         OR
  (b.name = 'Seiko'            AND wf.name ILIKE 'Prospex Marinemaster%')  OR
  (b.name = 'Seiko'            AND wf.name ILIKE 'Prospex Turtle%')        OR
  (b.name = 'Seiko'            AND wf.name ILIKE 'Prospex Sumo%')          OR
  (b.name = 'Seiko'            AND wf.name ILIKE '5 Sports%')              OR
  (b.name = 'Seiko'            AND wf.name ILIKE 'SKX%')                   OR
  (b.name = 'Seiko'            AND wf.name ILIKE 'Alpinist%')              OR
  (b.name = 'Grand Seiko'      AND wf.name ILIKE 'Heritage%')              OR
  (b.name = 'Grand Seiko'      AND wf.name ILIKE 'Evolution 9%')           OR
  (b.name = 'Grand Seiko'      AND wf.name ILIKE 'Sport%')                 OR
  (b.name = 'Grand Seiko'      AND wf.name ILIKE 'Elegance%')
ORDER BY placeholder;
```

---

## 4. Reconciliation notes

- **Family rows that must exist in `watch_families` before the seed update runs** (the script does UPDATE, not INSERT, on the catalog → it will silently fail to assign anything if these don't resolve): Rolex × {Submariner, Sea-Dweller, GMT-Master II, Daytona, Explorer, Datejust}; Omega × {Speedmaster Moonwatch, Seamaster Diver 300M, Seamaster Planet Ocean, Constellation}; AP × {Royal Oak, Royal Oak Offshore}; Tudor × {Black Bay, Pelagos}; Squale × {1521}; Christopher Ward × {C60 Trident}; Steinhart × {Ocean}; Swatch × {MoonSwatch}; Longines × {Legend Diver, Heritage Military, Spirit, HydroConquest}; Seiko × {Prospex Marinemaster, Prospex Turtle, Prospex Sumo, 5 Sports, SKX, Alpinist}; Grand Seiko × {Heritage, Evolution 9, Sport, Elegance}. That's 29 distinct family rows.
- **Longines references are best-effort and warrant manual verification.** Longines' reference-number scheme uses long `L3.xxx.x.xx.x` strings and I'm only ~60–70% confident on the exact decimals for individual variants (especially Spirit, Spirit Zulu Time, HydroConquest, and Heritage Military 1938). If the SQL returns NULL for a Longines row, look up the equivalent ref in your catalog and patch the placeholder before find-and-replace.
- **Grand Seiko reference confidence is mixed.** High confidence: SBGA211 (Snowflake), SBGA011 (early Snowflake), SLGH005 (White Birch), SBGW253 (44GS recreation). Medium confidence: SBGH205 (Hi-Beat 36000 — could be SBGH001/SBGH277 depending on dial), SLGA009 (Lake Suwa — verify), SBGA463 (Skyflake), SBGN013 (Quartz GMT Sport), SBGY007, SBGM221. Treat the second tier as candidates and verify against your catalog.
- **Seiko 6105 recreation reference ambiguity.** I used **SLA033** as the modern 6105-8110 "Captain Willard" recreation; if your catalog actually has **SLA039**, **SPB153**, or another ref for the Willard recreation, the tribute edge (6105-8110 → SLA033) and the catalog entry need adjusting.
- **Seiko market-code suffixes.** SKX007 ships as SKX007J1 (Japan, sapphire crystal in some runs) and SKX007K1 (other markets, Hardlex); same for SKX009/SKX009J1/K1 and the SRPD/SRPE/SBSA series. The SQL matches the bare ref — if your catalog stores `SKX007J1` rather than `SKX007`, change the IN clause or adjust the catalog.
- **References that may not exist in your catalog at all** (flagged so the SQL returning NULL doesn't surprise you): Squale `1521-026` (Squale ships many variant codes; the steel-bracelet Classic is the intended one); Christopher Ward `C60-300` and `C60-LDP38` are abbreviations of CW's longer alphanumeric refs — replace with whatever your catalog stores; Steinhart `Ocean-One-39` and `Ocean-OVM` are model-name proxies since Steinhart doesn't publish tidy ref numbers; Tudor `79230N` vs `79230B` vs `M79230N-0001` — pick whichever case your catalog uses; AP ROO `26420SO` is the steel/rubber chronograph variant — change to `26420OR` (rose gold) or another suffix if needed.
- **Lineage gaps acknowledged in notes, not seeded as separate entries:** Sub no-date `14060` (1989–1999) between 5513 and 14060M; Sea-Dweller `16660` (1978–1989) between 1665 and 16600; Explorer `14270` (1989–2001) and `114270` (2001–2010) between 1016 and 214270; Datejust `16013`/`16234` between 1601 and 116234; Speedmaster `105.002`/`105.003` between CK2998 and 105.012. Adding any of these would let the lineage chain step through them cleanly.
- **Squale 1521 family has only 1 seeded reference** — the "siblings" rail will be empty after self-exclusion. Add Squale `1521-094`, `1521-103`, or a 1545 variant if that UI matters.
- **All 7 Royal Oaks are assigned to a single `Royal Oak` family.** If your DB models the Jumbo Extra-Thin (15202/16202) as a separate family `__FAM__audemars-piguet__royal-oak-jumbo-extra-thin__`, change those two `familyId` strings before find-and-replace.
- **Sub/Sea-Dweller/GMT split into three families** per canonical horology. If your DB groups them into a single "Submariner" family (per the original prompt's category #1 phrasing), collapse the three `__FAM__rolex__...__` strings into `__FAM__rolex__submariner__`.
- **MoonSwatch brand attribution.** I used `Swatch` as the brand (Bioceramic line is sold through Swatch retail with Omega co-branding on the dial). If your catalog files it under `Omega` or a hyphenated `Swatch x Omega`, change the brand literal in the SQL IN-clause and the catalog placeholders' brand-slug component.
- **Tudor → Sub homage caveat.** The Black Bay's design heritage is the vintage **Tudor** Submariner line (7922/7924/7928/79090), which itself shared Rolex Sub cases. Calling BB a Rolex Sub homage is a transitive simplification; included per the original prompt's category #4.
- **Relationships considered and omitted because they aren't historically clear-cut:** Sinn 103 as Speedmaster homage (103 is a flieger pilot chrono, not a Speedy derivative); Strela / Poljot 3133 as Speedmaster homage (contemporary, not derivative); Longines HydroConquest as direct Sub homage (it's a generic sport diver, not specifically Sub-styled); any Seiko diver as Sub homage (Seiko's diver lineage starting with the 62MAS is parallel to, not derivative of, the Sub); Grand Seiko 44GS vintage (4420-9000) → SBGW253 tribute (real relationship, but I'd need to add the vintage 44GS to the catalog to seed it — worth a follow-up).

---

## 5. Workflow for the user

Paste the two TS arrays from section 2 into `scripts/seed-lineage.ts` between the TODO markers, then run the SQL block from section 3 in Supabase Studio. For each row in result-set 1, find-and-replace the `__CAT__…__` string in the file with the returned `uuid`; do the same for `__FAM__…__` placeholders against result-set 2. After all replacements, save the file and run `grep -E '__(CAT|FAM)__' scripts/seed-lineage.ts` — any remaining hits are references or families missing from your DB (cross-check against section 4) and need to be either removed from the seed arrays or inserted into the catalog/families tables before the script will run cleanly. Given the larger surface area this round, expect 5–10 Longines/GS/Seiko refs to come back NULL on the first pass — patch them iteratively.
