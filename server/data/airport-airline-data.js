// airport-airline-data.js — Real airport and airline data from public sources.
//
// Data sources:
// - Airports: OurAirports (https://ourairports.com/data/) — public domain CSV
//   GitHub: https://davidmegginson.github.io/ourairports-data/airports.csv
// - Airlines: OpenFlights (https://openflights.org/data) — open license
//   GitHub: https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat
//
// For the prototype, we bundle a curated subset of real airport and airline data
// for the 7 monitored regions. In production, this would fetch from the live APIs.

// ── Real airport data (subset from OurAirports) ─────────────────────
// Fields: iata, icao, name, city, country, lat, lon, scheduledService, type

const AIRPORTS = [
  // R1 — Indian Subcontinent
  { iata: 'BLR', icao: 'VOBL', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India', lat: 13.1986, lon: 77.7069, scheduled: true },
  { iata: 'MAA', icao: 'VOMM', name: 'Chennai International Airport', city: 'Chennai', country: 'India', lat: 12.9941, lon: 80.1709, scheduled: true },
  { iata: 'DEL', icao: 'VIDP', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India', lat: 28.5562, lon: 77.1000, scheduled: true },
  { iata: 'BOM', icao: 'VABB', name: 'Chhatrapati Shivaji International Airport', city: 'Mumbai', country: 'India', lat: 19.0896, lon: 72.8656, scheduled: true },
  { iata: 'HYD', icao: 'VOHS', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India', lat: 17.2403, lon: 78.4294, scheduled: true },
  { iata: 'COK', icao: 'VOCI', name: 'Cochin International Airport', city: 'Kochi', country: 'India', lat: 10.1520, lon: 76.4019, scheduled: true },
  { iata: 'CCU', icao: 'VECC', name: 'Netaji Subhas Chandra Bose Airport', city: 'Kolkata', country: 'India', lat: 22.6547, lon: 88.4467, scheduled: true },
  { iata: 'GOI', icao: 'VAGO', name: 'Goa Dabolim Airport', city: 'Goa', country: 'India', lat: 15.3808, lon: 73.8314, scheduled: true },
  { iata: 'PNQ', icao: 'VAPO', name: 'Pune Airport', city: 'Pune', country: 'India', lat: 18.5821, lon: 73.9197, scheduled: true },
  { iata: 'VTZ', icao: 'VEVZ', name: 'Visakhapatnam Airport', city: 'Visakhapatnam', country: 'India', lat: 17.7212, lon: 83.2245, scheduled: true },
  { iata: 'AMD', icao: 'VAAH', name: 'Sardar Vallabhbhai Patel Airport', city: 'Ahmedabad', country: 'India', lat: 23.0772, lon: 72.6347, scheduled: true },
  { iata: 'JAI', icao: 'VIJP', name: 'Jaipur International Airport', city: 'Jaipur', country: 'India', lat: 26.8242, lon: 75.8122, scheduled: true },
  { iata: 'LKO', icao: 'VILK', name: 'Chaudhary Charan Singh Airport', city: 'Lucknow', country: 'India', lat: 26.7606, lon: 80.8893, scheduled: true },
  { iata: 'IXC', icao: 'VIRC', name: 'Chandigarh Airport', city: 'Chandigarh', country: 'India', lat: 30.6735, lon: 76.7885, scheduled: true },
  { iata: 'GAU', icao: 'VEGT', name: 'Lokpriya Gopinath Bordoloi Airport', city: 'Guwahati', country: 'India', lat: 26.1061, lon: 91.5859, scheduled: true },
  { iata: 'CMB', icao: 'VCBI', name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka', lat: 7.1808, lon: 79.8842, scheduled: true },
  { iata: 'DAC', icao: 'VGHS', name: 'Hazrat Shahjalal International Airport', city: 'Dhaka', country: 'Bangladesh', lat: 23.8433, lon: 90.4006, scheduled: true },
  { iata: 'KTM', icao: 'VNKT', name: 'Tribhuvan International Airport', city: 'Kathmandu', country: 'Nepal', lat: 27.6966, lon: 85.3591, scheduled: true },
  { iata: 'ISB', icao: 'OPRN', name: 'Islamabad International Airport', city: 'Islamabad', country: 'Pakistan', lat: 33.5495, lon: 72.8260, scheduled: true },
  { iata: 'KHI', icao: 'OPKC', name: 'Jinnah International Airport', city: 'Karachi', country: 'Pakistan', lat: 24.9008, lon: 67.1681, scheduled: true },

  // R2 — Europe
  { iata: 'VIE', icao: 'LOWW', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria', lat: 48.1103, lon: 16.5697, scheduled: true },
  { iata: 'MUC', icao: 'EDDM', name: 'Munich Airport', city: 'Munich', country: 'Germany', lat: 48.3538, lon: 11.7861, scheduled: true },
  { iata: 'FRA', icao: 'EDDF', name: 'Frankfurt am Main Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622, scheduled: true },
  { iata: 'AMS', icao: 'EHAM', name: 'Amsterdam Schiphol Airport', city: 'Amsterdam', country: 'Netherlands', lat: 52.3105, lon: 4.7683, scheduled: true },
  { iata: 'CDG', icao: 'LFPG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479, scheduled: true },
  { iata: 'LHR', icao: 'EGLL', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.4700, lon: -0.4543, scheduled: true },
  { iata: 'LGW', icao: 'EGKK', name: 'London Gatwick Airport', city: 'London', country: 'United Kingdom', lat: 51.1481, lon: -0.1903, scheduled: true },
  { iata: 'BRU', icao: 'EBBR', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium', lat: 50.9014, lon: 4.4844, scheduled: true },
  { iata: 'ZRH', icao: 'LSZH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', lat: 47.4647, lon: 8.5492, scheduled: true },
  { iata: 'GVA', icao: 'LSGG', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland', lat: 46.2381, lon: 6.1090, scheduled: true },
  { iata: 'PRG', icao: 'LKPR', name: 'Vaclav Havel Airport Prague', city: 'Prague', country: 'Czech Republic', lat: 50.1008, lon: 14.2600, scheduled: true },
  { iata: 'BUD', icao: 'LHBP', name: 'Budapest Ferenc Liszt Airport', city: 'Budapest', country: 'Hungary', lat: 47.4369, lon: 19.2556, scheduled: true },
  { iata: 'CPH', icao: 'EKCH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', lat: 55.6181, lon: 12.6561, scheduled: true },
  { iata: 'OSL', icao: 'ENGM', name: 'Oslo Gardermoen Airport', city: 'Oslo', country: 'Norway', lat: 60.1939, lon: 11.1004, scheduled: true },
  { iata: 'EDI', icao: 'EGPH', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'United Kingdom', lat: 55.9500, lon: -3.3725, scheduled: true },
  { iata: 'FCO', icao: 'LIRF', name: 'Rome Fiumicino Airport', city: 'Rome', country: 'Italy', lat: 41.8003, lon: 12.2389, scheduled: true },
  { iata: 'MAD', icao: 'LEMD', name: 'Madrid Barajas Airport', city: 'Madrid', country: 'Spain', lat: 40.4983, lon: -3.5676, scheduled: true },
  { iata: 'IST', icao: 'LTFM', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', lat: 41.2753, lon: 28.7519, scheduled: true },
  { iata: 'WAW', icao: 'EPWA', name: 'Warsaw Chopin Airport', city: 'Warsaw', country: 'Poland', lat: 52.1657, lon: 20.9671, scheduled: true },
  { iata: 'ATH', icao: 'LGAV', name: 'Athens Eleftherios Venizelos Airport', city: 'Athens', country: 'Greece', lat: 37.9364, lon: 23.9445, scheduled: true },

  // R3 — Middle East / Gulf
  { iata: 'DXB', icao: 'OMDB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', lat: 25.2532, lon: 55.3657, scheduled: true },
  { iata: 'AUH', icao: 'OMAA', name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4330, lon: 54.6511, scheduled: true },
  { iata: 'DOH', icao: 'OTHH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', lat: 25.2731, lon: 51.6086, scheduled: true },
  { iata: 'MCT', icao: 'OOMS', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman', lat: 24.5481, lon: 58.2425, scheduled: true },
  { iata: 'BAH', icao: 'OBBI', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain', lat: 26.2708, lon: 50.6336, scheduled: true },
  { iata: 'RUH', icao: 'OERK', name: 'King Khalid International Airport', city: 'Riyadh', country: 'Saudi Arabia', lat: 24.9576, lon: 46.6988, scheduled: true },
  { iata: 'JED', icao: 'OEJN', name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.6796, lon: 39.1565, scheduled: true },
  { iata: 'KWI', icao: 'OKBK', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait', lat: 29.2266, lon: 47.9689, scheduled: true },
  { iata: 'AMM', icao: 'OJAI', name: 'Queen Alia International Airport', city: 'Amman', country: 'Jordan', lat: 31.7226, lon: 35.9933, scheduled: true },
  { iata: 'BEY', icao: 'OLBA', name: 'Beirut Rafic Hariri Airport', city: 'Beirut', country: 'Lebanon', lat: 33.8209, lon: 35.4884, scheduled: true },
  { iata: 'TLV', icao: 'LLBG', name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel', lat: 32.0114, lon: 34.8867, scheduled: true },

  // R4 — Southeast Asia
  { iata: 'SIN', icao: 'WSSS', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', lat: 1.3644, lon: 103.9915, scheduled: true },
  { iata: 'BKK', icao: 'VTBS', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.6900, lon: 100.7501, scheduled: true },
  { iata: 'KUL', icao: 'WMKK', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', lat: 2.7456, lon: 101.7099, scheduled: true },
  { iata: 'CGK', icao: 'WIII', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia', lat: -6.1256, lon: 106.6558, scheduled: true },
  { iata: 'MNL', icao: 'RPLL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines', lat: 14.5086, lon: 121.0194, scheduled: true },
  { iata: 'HAN', icao: 'VVNB', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam', lat: 21.2212, lon: 105.8071, scheduled: true },
  { iata: 'SGN', icao: 'VVTS', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8189, lon: 106.6519, scheduled: true },
  { iata: 'PNH', icao: 'VDPP', name: 'Phnom Penh International Airport', city: 'Phnom Penh', country: 'Cambodia', lat: 11.5466, lon: 104.8443, scheduled: true },
  { iata: 'RGN', icao: 'VYYY', name: 'Yangon International Airport', city: 'Yangon', country: 'Myanmar', lat: 16.9073, lon: 96.1332, scheduled: true },

  // R5 — North Atlantic / North America
  { iata: 'JFK', icao: 'KJFK', name: 'John F Kennedy International Airport', city: 'New York', country: 'United States', lat: 40.6413, lon: -73.7781, scheduled: true },
  { iata: 'EWR', icao: 'KEWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'United States', lat: 40.6925, lon: -74.1687, scheduled: true },
  { iata: 'YYZ', icao: 'CYYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada', lat: 43.6777, lon: -79.6248, scheduled: true },
  { iata: 'ORD', icao: 'KORD', name: "O'Hare International Airport", city: 'Chicago', country: 'United States', lat: 41.9742, lon: -87.9073, scheduled: true },
  { iata: 'ATL', icao: 'KATL', name: 'Hartsfield-Jackson Atlanta Airport', city: 'Atlanta', country: 'United States', lat: 33.6407, lon: -84.4277, scheduled: true },
  { iata: 'SFO', icao: 'KSFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', lat: 37.6213, lon: -122.3790, scheduled: true },
  { iata: 'LAX', icao: 'KLAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', lat: 33.9416, lon: -118.4085, scheduled: true },
  { iata: 'IAD', icao: 'KIAD', name: 'Washington Dulles International Airport', city: 'Washington', country: 'United States', lat: 38.9531, lon: -77.4565, scheduled: true },
  { iata: 'BOS', icao: 'KBOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'United States', lat: 42.3656, lon: -71.0096, scheduled: true },
  { iata: 'KEF', icao: 'BIKF', name: 'Keflavik International Airport', city: 'Reykjavik', country: 'Iceland', lat: 63.9850, lon: -22.6056, scheduled: true },
  { iata: 'SNN', icao: 'EINN', name: 'Shannon Airport', city: 'Shannon', country: 'Ireland', lat: 52.7019, lon: -8.9248, scheduled: true },

  // R6 — East Asia
  { iata: 'HKG', icao: 'VHHH', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', lat: 22.3080, lon: 113.9185, scheduled: true },
  { iata: 'NRT', icao: 'RJAA', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', lat: 35.7720, lon: 140.3929, scheduled: true },
  { iata: 'HND', icao: 'RJTT', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', lat: 35.5494, lon: 139.7798, scheduled: true },
  { iata: 'ICN', icao: 'RKSI', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', lat: 37.4602, lon: 126.4407, scheduled: true },
  { iata: 'PEK', icao: 'ZBAA', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China', lat: 40.0801, lon: 116.5846, scheduled: true },
  { iata: 'PVG', icao: 'ZSPD', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China', lat: 31.1443, lon: 121.8083, scheduled: true },
  { iata: 'CAN', icao: 'ZGGG', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'China', lat: 23.3924, lon: 113.2987, scheduled: true },
  { iata: 'TPE', icao: 'RCTP', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'Taiwan', lat: 25.0797, lon: 121.2342, scheduled: true },

  // R7 — Africa
  { iata: 'JNB', icao: 'FAOR', name: 'OR Tambo International Airport', city: 'Johannesburg', country: 'South Africa', lat: -26.1392, lon: 28.2460, scheduled: true },
  { iata: 'CPT', icao: 'FACT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'South Africa', lat: -33.9648, lon: 18.6017, scheduled: true },
  { iata: 'NBO', icao: 'HKJK', name: 'Jomo Kenyatta International Airport', city: 'Nairobi', country: 'Kenya', lat: -1.3192, lon: 36.9278, scheduled: true },
  { iata: 'ADD', icao: 'HAAB', name: 'Addis Ababa Bole International Airport', city: 'Addis Ababa', country: 'Ethiopia', lat: 8.9778, lon: 38.7990, scheduled: true },
  { iata: 'CAI', icao: 'HECA', name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt', lat: 30.1219, lon: 31.4056, scheduled: true },
  { iata: 'LOS', icao: 'DNMM', name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria', lat: 6.5774, lon: 3.3211, scheduled: true },
  { iata: 'ACC', icao: 'DGAA', name: 'Kotoka International Airport', city: 'Accra', country: 'Ghana', lat: 5.6051, lon: -0.1668, scheduled: true },
  { iata: 'DKR', icao: 'GOOY', name: 'Blaise Diagne International Airport', city: 'Dakar', country: 'Senegal', lat: 14.6708, lon: -17.0729, scheduled: true },
];

// ── Real airline data (subset from OpenFlights) ─────────────────────
// Fields: name, iata, icao, country, active

const AIRLINES = [
  // India
  { name: 'IndiGo', iata: '6E', icao: 'IGO', country: 'India', active: true },
  { name: 'Air India', iata: 'AI', icao: 'AIC', country: 'India', active: true },
  { name: 'SpiceJet', iata: 'SG', icao: 'SEJ', country: 'India', active: true },
  { name: 'Vistara', iata: 'UK', icao: 'VTI', country: 'India', active: true },
  { name: 'Air India Express', iata: 'IX', icao: 'AXB', country: 'India', active: true },
  { name: 'Akasa Air', iata: 'QP', icao: 'AKJ', country: 'India', active: true },
  { name: 'Go First', iata: 'G8', icao: 'GOW', country: 'India', active: false },
  // Europe
  { name: 'Lufthansa', iata: 'LH', icao: 'DLH', country: 'Germany', active: true },
  { name: 'Air France', iata: 'AF', icao: 'AFR', country: 'France', active: true },
  { name: 'KLM', iata: 'KL', icao: 'KLM', country: 'Netherlands', active: true },
  { name: 'British Airways', iata: 'BA', icao: 'BAW', country: 'United Kingdom', active: true },
  { name: 'Swiss International Air Lines', iata: 'LX', icao: 'SWR', country: 'Switzerland', active: true },
  { name: 'Austrian Airlines', iata: 'OS', icao: 'AUA', country: 'Austria', active: true },
  { name: 'Brussels Airlines', iata: 'SN', icao: 'BEL', country: 'Belgium', active: true },
  { name: 'ITA Airways', iata: 'AZ', icao: 'ITY', country: 'Italy', active: true },
  { name: 'Iberia', iata: 'IB', icao: 'IBE', country: 'Spain', active: true },
  { name: 'SAS', iata: 'SK', icao: 'SAS', country: 'Sweden', active: true },
  { name: 'Norwegian Air Shuttle', iata: 'DY', icao: 'NAX', country: 'Norway', active: true },
  { name: 'LOT Polish Airlines', iata: 'LO', icao: 'LOT', country: 'Poland', active: true },
  { name: 'Turkish Airlines', iata: 'TK', icao: 'THY', country: 'Turkey', active: true },
  { name: 'Wizz Air', iata: 'W6', icao: 'WZZ', country: 'Hungary', active: true },
  { name: 'Ryanair', iata: 'FR', icao: 'RYR', country: 'Ireland', active: true },
  { name: 'easyJet', iata: 'U2', icao: 'EZY', country: 'United Kingdom', active: true },
  { name: 'Eurowings', iata: 'EW', icao: 'EWG', country: 'Germany', active: true },
  // Middle East
  { name: 'Emirates', iata: 'EK', icao: 'UAE', country: 'United Arab Emirates', active: true },
  { name: 'Etihad Airways', iata: 'EY', icao: 'ETD', country: 'United Arab Emirates', active: true },
  { name: 'Qatar Airways', iata: 'QR', icao: 'QTR', country: 'Qatar', active: true },
  { name: 'Oman Air', iata: 'WY', icao: 'OMA', country: 'Oman', active: true },
  { name: 'Gulf Air', iata: 'GF', icao: 'GFA', country: 'Bahrain', active: true },
  { name: 'Saudia', iata: 'SV', icao: 'SVA', country: 'Saudi Arabia', active: true },
  { name: 'Kuwait Airways', iata: 'KU', icao: 'KAC', country: 'Kuwait', active: true },
  { name: 'Royal Jordanian', iata: 'RJ', icao: 'RJA', country: 'Jordan', active: true },
  { name: 'EL AL Israel Airlines', iata: 'LY', icao: 'ELY', country: 'Israel', active: true },
  // Southeast Asia
  { name: 'Singapore Airlines', iata: 'SQ', icao: 'SIA', country: 'Singapore', active: true },
  { name: 'Thai Airways', iata: 'TG', icao: 'THA', country: 'Thailand', active: true },
  { name: 'Malaysia Airlines', iata: 'MH', icao: 'MAS', country: 'Malaysia', active: true },
  { name: 'AirAsia', iata: 'AK', icao: 'AXM', country: 'Malaysia', active: true },
  { name: 'Garuda Indonesia', iata: 'GA', icao: 'GIA', country: 'Indonesia', active: true },
  { name: 'Philippine Airlines', iata: 'PR', icao: 'PAL', country: 'Philippines', active: true },
  { name: 'Cebu Pacific', iata: '5J', icao: 'CEB', country: 'Philippines', active: true },
  { name: 'Vietnam Airlines', iata: 'VN', icao: 'HVN', country: 'Vietnam', active: true },
  { name: 'VietJet Air', iata: 'VJ', icao: 'VJC', country: 'Vietnam', active: true },
  // North America
  { name: 'American Airlines', iata: 'AA', icao: 'AAL', country: 'United States', active: true },
  { name: 'Delta Air Lines', iata: 'DL', icao: 'DAL', country: 'United States', active: true },
  { name: 'United Airlines', iata: 'UA', icao: 'UAL', country: 'United States', active: true },
  { name: 'Southwest Airlines', iata: 'WN', icao: 'SWA', country: 'United States', active: true },
  { name: 'JetBlue Airways', iata: 'B6', icao: 'JBU', country: 'United States', active: true },
  { name: 'Air Canada', iata: 'AC', icao: 'ACA', country: 'Canada', active: true },
  { name: 'WestJet', iata: 'WS', icao: 'WJA', country: 'Canada', active: true },
  // East Asia
  { name: 'Cathay Pacific', iata: 'CX', icao: 'CPA', country: 'Hong Kong', active: true },
  { name: 'Japan Airlines', iata: 'JL', icao: 'JAL', country: 'Japan', active: true },
  { name: 'All Nippon Airways', iata: 'NH', icao: 'ANA', country: 'Japan', active: true },
  { name: 'Korean Air', iata: 'KE', icao: 'KAL', country: 'South Korea', active: true },
  { name: 'Asiana Airlines', iata: 'OZ', icao: 'AAR', country: 'South Korea', active: true },
  { name: 'China Southern Airlines', iata: 'CZ', icao: 'CSN', country: 'China', active: true },
  { name: 'Air China', iata: 'CA', icao: 'CCA', country: 'China', active: true },
  { name: 'China Eastern Airlines', iata: 'MU', icao: 'CES', country: 'China', active: true },
  { name: 'EVA Air', iata: 'BR', icao: 'EVA', country: 'Taiwan', active: true },
  { name: 'China Airlines', iata: 'CI', icao: 'CAL', country: 'Taiwan', active: true },
  // Africa
  { name: 'South African Airways', iata: 'SA', icao: 'SAA', country: 'South Africa', active: true },
  { name: 'FlySafair', iata: 'FA', icao: 'SFA', country: 'South Africa', active: true },
  { name: 'Kenya Airways', iata: 'KQ', icao: 'KQA', country: 'Kenya', active: true },
  { name: 'Ethiopian Airlines', iata: 'ET', icao: 'ETH', country: 'Ethiopia', active: true },
  { name: 'EgyptAir', iata: 'MS', icao: 'MSR', country: 'Egypt', active: true },
  // Global / Multi-region
  { name: 'Qantas', iata: 'QF', icao: 'QFA', country: 'Australia', active: true },
  { name: 'Air New Zealand', iata: 'NZ', icao: 'ANZ', country: 'New Zealand', active: true },
  { name: 'Cathay Pacific', iata: 'CX', icao: 'CPA', country: 'Hong Kong', active: true },
];

// ── Region → Country mapping ────────────────────────────────────────
// Maps each monitored region to the countries whose airspace is relevant.

const REGION_COUNTRIES = {
  R1: ['India', 'Pakistan', 'Sri Lanka', 'Bangladesh', 'Nepal'],
  R2: ['Austria', 'Germany', 'France', 'United Kingdom', 'Netherlands', 'Belgium', 'Switzerland', 'Czech Republic', 'Hungary', 'Denmark', 'Norway', 'Italy', 'Spain', 'Turkey', 'Poland', 'Greece', 'Ireland', 'Iceland'],
  R3: ['United Arab Emirates', 'Qatar', 'Oman', 'Bahrain', 'Saudi Arabia', 'Kuwait', 'Jordan', 'Lebanon', 'Israel', 'Iran', 'Iraq'],
  R4: ['Singapore', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'Cambodia', 'Myanmar'],
  R5: ['United States', 'Canada', 'Iceland', 'Ireland', 'United Kingdom'],
  R6: ['Hong Kong', 'Japan', 'South Korea', 'China', 'Taiwan'],
  R7: ['South Africa', 'Kenya', 'Ethiopia', 'Egypt', 'Nigeria', 'Ghana', 'Senegal', 'Sudan'],
};

// ── API ─────────────────────────────────────────────────────────────

// Get all airports
export function getAllAirports() {
  return AIRPORTS;
}

// Get airport by IATA code
export function getAirport(iata) {
  return AIRPORTS.find((a) => a.iata === iata) || null;
}

// Get airports for a specific region (by matching country to region mapping)
export function getAirportsByRegion(regionId) {
  const countries = REGION_COUNTRIES[regionId] || [];
  return AIRPORTS.filter((a) => countries.includes(a.country));
}

// Get airports for a specific country
export function getAirportsByCountry(country) {
  return AIRPORTS.filter((a) => a.country === country);
}

// Get all airlines
export function getAllAirlines() {
  return AIRLINES;
}

// Get airline by IATA code
export function getAirline(iata) {
  return AIRLINES.find((a) => a.iata === iata) || null;
}

// Get airlines for a specific region (by country)
export function getAirlinesByRegion(regionId) {
  const countries = REGION_COUNTRIES[regionId] || [];
  return AIRLINES.filter((a) => countries.includes(a.country));
}

// Get airlines for a specific country
export function getAirlinesByCountry(country) {
  return AIRLINES.filter((a) => a.country === country);
}

// Get countries for a region
export function getCountriesByRegion(regionId) {
  return REGION_COUNTRIES[regionId] || [];
}

// Get full region profile: airports + airlines + countries
export function getRegionProfile(regionId) {
  const countries = getCountriesByRegion(regionId);
  const airports = getAirportsByRegion(regionId);
  const airlines = getAirlinesByRegion(regionId);
  return { regionId, countries, airports, airlines };
}

export default {
  getAllAirports,
  getAirport,
  getAirportsByRegion,
  getAirportsByCountry,
  getAllAirlines,
  getAirline,
  getAirlinesByRegion,
  getAirlinesByCountry,
  getCountriesByRegion,
  getRegionProfile,
};
