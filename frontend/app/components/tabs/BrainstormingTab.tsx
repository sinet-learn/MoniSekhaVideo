/* eslint-disable */
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useProjectContext } from "../../context/ProjectContext";
import { 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Sliders, 
  FileText, 
  PenLine, 
  ArrowRight, 
  Trash2, 
  RefreshCw, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Palette,
  Compass,
  FileCode2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Eye,
  X,
  Shirt,
  RotateCcw,
  LayoutTemplate,
  CornerDownLeft,
  Columns2,
  Maximize2,
  Minimize2,
  GripVertical,
  Clock,
  Loader2,
  Zap,
  Wand2,
  Lightbulb
} from "lucide-react";
import { splitNarrationIntoScenes } from "../../utils/sceneTiming";
import { estimateTextStats } from "../../utils/textStats";

interface BrainstormingTabProps {
  activeProject?: any;
  refreshProjectData?: () => Promise<void>;
}

// Preset Era options
const ERA_OPTIONS = [
  { 
    id: "ancient", 
    label: "🦖 Ancient / Prehistoric", 
    shortLabel: "🦖 Ancient",
    desc: "Stone Age, primitive shelters, tribal hunter-gatherers, river valleys & caves",
  },
  { 
    id: "medieval", 
    label: "🏰 Medieval / Feudal", 
    shortLabel: "🏰 Medieval",
    desc: "Feudal kingdoms, ancient stone temples/castles, stilt villages, markets & trade",
  },
  { 
    id: "90s", 
    label: "📼 90s / Retro", 
    shortLabel: "📼 90s Retro",
    desc: "Analog era, vintage motorbikes, CRT monitors, retro markets & cassettes",
  },
  { 
    id: "modern", 
    label: "📱 Today / Modern", 
    shortLabel: "📱 Modern",
    desc: "Contemporary cities, coffee shops, smartphones, modern transportation & offices",
  },
  { 
    id: "scifi", 
    label: "🚀 Future / Sci-Fi", 
    shortLabel: "🚀 Sci-Fi",
    desc: "Futuristic smart cities, solar Mekong floating pods, holographic UI & drones",
  },
  { 
    id: "dystopian", 
    label: "☢️ Dystopian", 
    shortLabel: "☢️ Dystopian",
    desc: "Overgrown ruins, scavenged outposts, survival settlements & salvage gear",
  },
];

// Preset Region & Country options (Cambodia as dedicated primary option)
const REGION_OPTIONS = [
  {
    id: "cambodia",
    label: "🇰🇭 Cambodia / Khmer",
    shortLabel: "🇰🇭 Cambodia",
    flag: "🇰🇭",
    desc: "Angkor stone prasats, wooden stilt houses, barays, sugar palms, kramas, sampots, Tonle Sap",
  },
  {
    id: "western",
    label: "🏰 Europe / Western",
    shortLabel: "🏰 Western",
    flag: "🏰",
    desc: "Stone castles, cobblestone feudal villages, western retro & modern glass cities",
  },
  {
    id: "east_asia",
    label: "⛩️ East Asia",
    shortLabel: "⛩️ East Asia",
    flag: "⛩️",
    desc: "Curved tiled roof pagodas, courtyard compounds, bamboo groves, Asian cityscapes & robes",
  },
  {
    id: "south_asia",
    label: "🇮🇳 South Asia",
    shortLabel: "🇮🇳 South Asia",
    flag: "🇮🇳",
    desc: "Carved stone shrines, river ghats, draped cotton fabrics, vibrant ancient & modern bazaars",
  },
  {
    id: "middle_east",
    label: "🕌 Middle East",
    shortLabel: "🕌 Middle East",
    flag: "🕌",
    desc: "Domed architecture, oasis towns, desert caravans, courtyards, souks, flowing robes",
  },
  {
    id: "global",
    label: "🌍 Global / Universal",
    shortLabel: "🌍 Global",
    flag: "🌍",
    desc: "Universal archetypes, neutral landscapes, international modern cities without regional bias",
  },
];

export interface EraRegionDetail {
  eraTitle: string;
  regionTitle: string;
  attire: string;
  hair: string;
  props: string;
  environment: string;
  culturalDirectives: string;
  examples: {
    wideOverview: string;
    birdsEyeView: string;
    visualDiagram: string;
    characterAction: string;
  };
}

export function getEraRegionSetting(eraId: string, regionId: string): EraRegionDetail {
  const isCambodia = regionId === "cambodia";
  const isEastAsia = regionId === "east_asia";
  const isSouthAsia = regionId === "south_asia";
  const isMiddleEast = regionId === "middle_east";
  const isWestern = regionId === "western";

  // 1. MEDIEVAL / FEUDAL
  if (eraId === "medieval") {
    if (isCambodia) {
      return {
        eraTitle: "🏰 Medieval / Feudal (Angkorian Khmer Empire)",
        regionTitle: "🇰🇭 Cambodia / Khmer",
        attire: "Traditional Khmer sampot or chong kben cotton wrap cloth, checkered cotton krama scarf around neck or waist, bare feet or simple leather sandals",
        hair: "Neat traditional Khmer topknot, neat cropped dark hair, or cloth headband",
        props: "Inscribed palm-leaf manuscript (sasstra slok reth), clay water urn, woven bamboo basket, bronze spear, ox cart with wooden wheels, brass gong",
        environment: "Angkor-style carved sandstone prasat temple spires, elevated wooden stilt houses along rivers and canals, wide baray water reservoirs, towering sugar palm trees, lush tropical countryside",
        culturalDirectives: "Authentic Angkorian Khmer civilization (9th–15th century). STRICTLY NO European knights, NO iron armor, NO European stone castles, NO wax-sealed European scrolls. Depict ancient Khmer stone architecture, wooden stilt houses, and Buddhist/Hindu stone motifs.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of an ancient Angkorian Khmer settlement, showing wooden stilt houses along a wide river canal, towering stone prasat temple spires in the distance, lush sugar palm trees, multiple tiny stickman villagers walking and paddling wooden boats, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view looking down on a bustling ancient Khmer riverside market, neatly arranged woven mats with tropical fruit and pottery, ox carts parked nearby, tiny stick figures trading and walking between stalls, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, architectural cutaway cross-section of a traditional Khmer wooden stilt house, showing the elevated living platform on wooden pillars above, storage and loom area underneath, stickmen demonstrating daily activities, clean diagram layout, bold black outlines, flat solid colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a Khmer royal messenger stickman wearing a green chong kben wrap and krama, running along a stone temple terrace holding a rolled palm-leaf manuscript (sasstra), temple spires and palm trees in the wide background, bold black outlines, flat solid colors."
        }
      };
    }
    if (isEastAsia) {
      return {
        eraTitle: "🏰 Medieval / Feudal (East Asian Dynasties)",
        regionTitle: "⛩️ East Asia",
        attire: "Traditional linen robe (hanfu/kimono/hanbok) or martial tunic, cloth sash, woven straw sandals",
        hair: "Topknot bun with wooden hairpin or woven conical straw hat",
        props: "Calligraphy brush, ink stone, bamboo scroll, ceramic teapot, wooden cart",
        environment: "Curved tiled roof pagodas, wooden courtyard compounds, stone bridges over koi canals, misty bamboo groves",
        culturalDirectives: "Historical East Asian architecture and attire. Pagodas, bamboo groves, paper lanterns, and stone bridges.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a traditional East Asian mountain valley town, tiered wooden pagodas with curved roofs, stone bridge over a quiet river, misty bamboo forest, tiny stick figures walking on cobblestone paths, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a walled palace courtyard compound, symmetry of tiled rooftops, garden courtyards, and tiny stick figures strolling along covered pavilions, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section of a traditional multi-tier wooden pagoda, showing interlocking wooden timber joints without nails, central pillar, and stickman carpenters at work, clean diagram layout, bold black outlines, flat solid colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of an East Asian scholar stickman in flowing blue robe holding an ink brush at a low wooden table overlooking a tranquil garden, bold black outlines, flat solid colors."
        }
      };
    }
    if (isSouthAsia) {
      return {
        eraTitle: "🏰 Medieval / Classical (South Asian Kingdoms)",
        regionTitle: "🇮🇳 South Asia",
        attire: "Traditional draped cotton dhoti/angavastram or sari wrap, ornate armlet, bare feet",
        hair: "Neat tied hair bun or draped turban",
        props: "Carved palm-leaf texts, brass lamp, clay pottery, ornate parasol, decorated elephant saddle",
        environment: "Intricate carved stone temple gopurams, riverside bathing ghats, royal pillared courtyards, banyan trees",
        culturalDirectives: "Classical South Asian architectural motifs, stepwells, stone temples, and draped cotton attire.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a medieval South Asian river kingdom, towering stone temple gopuram spires, ghat steps leading down to a sacred river, tiny stick figures in dhotis walking, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view looking down at a geometrical stepwell reservoir, intricate stone stair patterns leading down to water, tiny stick figures carrying clay pots, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, architectural layout diagram of an ancient stone temple complex, showing outer pillared corridors, sanctum tower, and ceremonial courtyard, clean infographic layout, bold outlines, flat solid colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a stickman merchant in a draped dhoti displaying brass lamps and spice sacks on a riverside terrace, banyan tree in wide background, bold black outlines, flat solid colors."
        }
      };
    }
    if (isMiddleEast) {
      return {
        eraTitle: "🏰 Medieval / Golden Age (Middle East & Arabia)",
        regionTitle: "🕌 Middle East",
        attire: "Flowing linen thobe or tunic, embroidered vest, leather sandals, wrapped turban",
        hair: "Wrapped keffiyeh or turban",
        props: "Brass astrolabe, leather-bound illuminated manuscript, ceramic oil lamp, spice sacks, camel caravan",
        environment: "Arched stone courtyards, geometric mosaic tile fountains, domed bazaars, desert oasis with date palms",
        culturalDirectives: "Islamic Golden Age & Middle Eastern heritage. Domes, arched courtyards, oasis settlements, and caravans.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a desert oasis city, turquoise domed towers, adobe city walls, date palms, tiny stickman traders walking alongside camels, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a covered vaulted souk marketplace, light filtering through roof skylights onto bustling textile stalls and tiny stick figures, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section diagram of an ancient desert windcatcher tower and underground qanat water channel, showing cooling airflow, clean educational layout, bold outlines, flat solid colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of an astronomer stickman in flowing robes holding a brass astrolabe on an open rooftop terrace under star-filled twilight, minarets in wide background, bold black outlines, flat solid colors."
        }
      };
    }
    // Western / Global Medieval
    return {
      eraTitle: "🏰 Medieval / Feudal (European Middle Ages)",
      regionTitle: "🏰 Europe / Western",
      attire: "Coarse linen peasant tunic with leather belt, woolen trousers, worn leather boots",
      hair: "Shaggy medieval peasant haircut or hooded cloth cowl",
      props: "Iron lantern, wooden barrel, torch, quill and scroll, wooden cart",
      environment: "Stone castle walls, cobblestone feudal village, half-timbered wooden tavern, muddy road, dungeons",
      culturalDirectives: "European feudal Middle Ages. Stone castle ramparts, cobblestone villages, wooden taverns, and rolling hills.",
      examples: {
        wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a medieval European feudal town, cobblestone streets leading to distant stone castle ramparts, half-timbered houses, multiple tiny stickman townsfolk walking, bold black outlines, flat solid colors.",
        birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view looking down at a medieval fortress and courtyard, showing stone outer curtain walls, central keep, training grounds, and tiny stick figures patrolling, bold black outlines, flat solid colors.",
        visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section of a medieval fortified castle tower, revealing dungeon, great banquet hall, armory, and rooftop battlements, stick figures showing functions, clean layout, bold outlines, flat solid colors.",
        characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a medieval messenger stickman in leather boots running across a wooden drawbridge towards castle gates, rolling countryside in the wide background, bold black outlines, flat solid colors."
      }
    };
  }

  // 2. 90s / RETRO
  if (eraId === "90s") {
    if (isCambodia) {
      return {
        eraTitle: "📼 90s / Retro (Post-UNTAC Cambodia)",
        regionTitle: "🇰🇭 Cambodia / Khmer",
        attire: "Vintage 90s patterned short-sleeved button-up shirt, high-waisted casual trousers or traditional cotton sarong, slip-on sandals",
        hair: "Classic 90s middle-parted feathered hair or casual vintage cap",
        props: "Vintage Honda Super Cub or Daelim City motorbike, cassette tape boombox with Khmer pop tape, bulky tube CRT television with rabbit-ear antenna, open-air wooden market stalls with canvas umbrellas",
        environment: "1990s Phnom Penh streetscape with weathered yellow French colonial shophouses, pedicab cyclos (xich lo), tangled overhead wires, dusty red-dirt roads, wooden stilt houses with zinc roofs",
        culturalDirectives: "Authentic 1990s Cambodian everyday life. Nostalgic post-UNTAC era street scenes, vintage motorbikes, local market life, tropical street vendors.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a 1990s Phnom Penh street corner, weathered yellow French colonial shophouse buildings, vintage Honda Super Cub motorbikes and pedicab cyclos parked along the road, tiny stickmen walking, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view looking down on a bustling 1990s Cambodian outdoor market, colorful canvas umbrellas shading fruit and vegetable baskets, narrow alleys packed with shoppers, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, side-by-side comparison diagram of 1990s Cambodian communication: postal mail and cassette tape exchange on left vs early radio broadcast on right, stick figures demonstrating, clean infographic layout, bold outlines, flat colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a 90s Cambodian stickman wearing a vintage patterned short-sleeve shirt riding a vintage motorbike past roadside food stalls, tropical palm trees in background, bold black outlines, flat solid colors."
        }
      };
    }
    if (isEastAsia) {
      return {
        eraTitle: "📼 90s / Retro (East Asian 90s Boom)",
        regionTitle: "⛩️ East Asia",
        attire: "Oversized 90s blazer or denim jacket, loose slacks, platform sneakers, Walkman headphones",
        hair: "90s styled anime-era parted hair or bob",
        props: "Cassette player, retro arcade cabinet, colorful vending machines, pager, payphone",
        environment: "1990s Tokyo/Hong Kong street scene with glowing neon signs, elevated train tracks, narrow shopping alleys",
        culturalDirectives: "1990s East Asian retro aesthetic. City neon signs, elevated trains, retro electronics, and bustling alleys.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a 1990s Tokyo city street, colorful neon shop signs, elevated train passing on tracks overhead, tiny stickman pedestrians with umbrellas, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a 90s multi-story arcade game center, rows of glowing CRT arcade cabinets, tiny stick figures playing fighting games, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section diagram of a 1990s Japanese capsule hotel or apartment block, showing compact living units and tiny stickmen, clean diagram layout, bold outlines, flat solid colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a 90s student stickman with headphones listening to a Walkman cassette player waiting at a train station platform, city skyline in background, bold black outlines, flat solid colors."
        }
      };
    }
    // Western / Global 90s
    return {
      eraTitle: "📼 90s / Retro (Western Analog Era)",
      regionTitle: "🏰 Europe / Western",
      attire: "Oversized vintage color-block windbreaker, graphic t-shirt, baggy denim jeans, chunky retro sneakers",
      hair: "90s curtains/middle-parted haircut or backwards baseball cap",
      props: "Chunky CRT monitor, cassette Walkman, floppy disks, dial-up modem, messy desk",
      environment: "Analog suburban bedroom, retro electronics shop, brick school corridors, arcade hall, shopping mall",
      culturalDirectives: "Western 1990s analog culture. CRT computers, dial-up internet, suburban streets, and malls.",
      examples: {
        wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a 1990s suburban street, brick houses, station wagon cars, kids on rollerblades, telephone poles, bold black outlines, flat solid colors.",
        birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a 90s shopping mall interior, neon-signed shopfronts, central food court, tiny stickman shoppers walking between stores, bold black outlines, flat solid colors.",
        visualDiagram: "Minimalist 2D flat vector educational diagram, step-by-step visual process of dial-up internet connection in the 90s: computer, modem handshake, telephone line, server, stickman waiting, clean diagram layout, bold outlines, flat solid colors.",
        characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a stickman wearing a baggy windbreaker sitting at a desk with a chunky CRT monitor and cassette tapes, poster-covered bedroom in background, bold black outlines, flat solid colors."
      }
    };
  }

  // 3. TODAY / MODERN
  if (eraId === "modern") {
    if (isCambodia) {
      return {
        eraTitle: "📱 Today / Modern (Contemporary Cambodia)",
        regionTitle: "🇰🇭 Cambodia / Khmer",
        attire: "Neat modern casual linen shirt or minimalist graphic tee, dark jeans or chinos, white sneakers",
        hair: "Neat contemporary fade or textured modern crop",
        props: "Modern smartphone with PassApp or ABA banking app, iced milk coffee in takeaway plastic cup with straw, modern laptop, motorcycle helmet",
        environment: "Modern Phnom Penh urban cafe with glass windows and tropical indoor plants, bustling street with tuktuks, PassApp motor-tricycles, modern boulevards, mix of sleek modern buildings and tropical palm trees",
        culturalDirectives: "Contemporary Cambodian lifestyle. Vibrant Phnom Penh cityscape, modern coffee shops, mobile-first everyday technology, street tuktuks.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a modern Phnom Penh city boulevard, glass high-rise towers mixed with classic French shophouses, modern tuktuks and cars driving on the wide road, tiny stick figures walking on tree-lined sidewalks, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view looking down on a busy contemporary city roundabout, modern vehicles, tuktuks, and pedestrian crossings neatly organized, tiny stick figures commuting, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, side-by-side comparative infographic showing modern digital mobile banking and QR payments on left versus traditional cash transactions on right, stickmen interacting, clean vector layout, bold black outlines, flat colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a modern Cambodian stickman holding a takeaway iced coffee cup and smartphone standing in front of a trendy glass-fronted cafe, tuktuk passing on the street behind him, bold black outlines, flat solid colors."
        }
      };
    }
    if (isEastAsia) {
      return {
        eraTitle: "📱 Today / Modern (Contemporary East Asia)",
        regionTitle: "⛩️ East Asia",
        attire: "Sleek minimalist monochrome streetwear, tailored trousers, clean sneakers, wireless earbuds",
        hair: "Neat modern textured haircut or sleek bob",
        props: "High-end smartphone, subway transit card, convenience store bento box, ultrabook laptop",
        environment: "Modern high-density metropolis, glass transit hubs, 24-hour convenience stores, sleek high-speed rail",
        culturalDirectives: "Modern high-tech East Asian metropolis. Clean transit systems, convenience stores, and towering glass skyscrapers.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a modern East Asian metropolis, towering glass skyscrapers, sleek bullet train gliding on elevated viaduct, bustling pedestrian crossing below with tiny stick figures, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a modern multi-track railway terminal, bullet trains at platforms, concourses with tiny commuting stick figures, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section of a 24-hour modern convenience store, showing refrigerated drink shelves, automated checkout, and hot food counter with stick figures, clean diagram layout, bold outlines, flat solid colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a commuter stickman with umbrella crossing a broad illuminated glass bridge with streaming headlights in the highway below, bold black outlines, flat solid colors."
        }
      };
    }
    // Western / Global Modern
    return {
      eraTitle: "📱 Today / Modern (Global Urban Modern)",
      regionTitle: "🏰 Europe / Western",
      attire: "Clean modern hoodie or casual jacket, minimalist t-shirt, dark jeans, white sneakers",
      hair: "Neat styled contemporary haircut (textured crop or modern fade)",
      props: "Smartphone, laptop, minimalist ceramic mug, clean desk, reusable water bottle",
      environment: "Urban minimalist apartments, glass skyscraper offices, modern subway station, open plazas, coffee shops",
      culturalDirectives: "Contemporary global urban lifestyle. Minimalist interiors, glass offices, open public plazas, and tech-enabled city life.",
      examples: {
        wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a modern downtown city square, glass skyscrapers, subway entrance, outdoor seating plaza with tiny stick figures drinking coffee and working on laptops, bold black outlines, flat solid colors.",
        birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view looking down at a modern tech office floorplan, open-plan desks, meeting pods, coffee bar, tiny stick figures collaborating, bold black outlines, flat solid colors.",
        visualDiagram: "Minimalist 2D flat vector educational diagram, visual flow process of modern cloud data synchronization: smartphone, wireless signal, cloud server, laptop, clean educational layout, bold black outlines, flat solid colors.",
        characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a stickman with a backpack walking across a modern glass pedestrian bridge overlooking city traffic, bold black outlines, flat solid colors."
      }
    };
  }

  // 4. ANCIENT / PREHISTORIC (Broad view enhanced for all eras including ancient!)
  if (eraId === "ancient") {
    if (isCambodia || isEastAsia || isSouthAsia) {
      return {
        eraTitle: "🦖 Ancient / Prehistoric (Tropical Southeast Asia)",
        regionTitle: "🇰🇭 Cambodia / Southeast Asia",
        attire: "Ragged woven bark or palm-fiber wrap, primitive animal hide loincloth, bead necklace made of river shells and seeds",
        hair: "Wild messy dark prehistoric hair with woven fiber headband",
        props: "Polished Neolithic stone adze, bamboo spear with fire-hardened tip, clay pot, woven rattan fish trap",
        environment: "Lush tropical prehistoric river valley, limestone karst cave opening, bamboo stilt shelter, wild tropical jungle and riverbanks",
        culturalDirectives: "Prehistoric tropical Southeast Asian environment. Lush jungle rivers, bamboo tools, limestone karst caves, Asian wild elephants and water buffalo (STRICTLY NO woolly mammoths, NO glaciers).",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a lush prehistoric tropical river valley, limestone karst cliffs in distance, bamboo stilt shelters along the riverbank, tiny stickman hunter-gatherers fishing and gathering, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a prehistoric tropical river settlement, circular thatched huts arranged near fishing traps and canoes, tiny stick figures smoking fish over fire pits, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, side-by-side comparison diagram showing early crude river-pebble tools on left versus polished Neolithic stone adzes on right, stickmen demonstrating use, clean infographic layout, bold outlines, flat colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of three prehistoric stickmen in fiber wraps working together to carve a dugout wooden canoe by the riverbank, dense tropical jungle in background, bold black outlines, flat solid colors."
        }
      };
    }
    // Western / Global Prehistoric (Ice Age)
    return {
      eraTitle: "🦖 Ancient / Prehistoric (Ice Age / Mammoth Steppe)",
      regionTitle: "🌍 Global Ice Age",
      attire: "Thick woolly mammoth fur pelt wrap, ragged animal hide tunic, stitched leather boots",
      hair: "Wild, thick, messy prehistoric caveman hair",
      props: "Flint spear, carved bone needle, primitive stone campfire, mammoth tusks",
      environment: "Snowy glacial plains, vast ice cliffs, rugged prehistoric rock cave, roaming mammoth herds",
      culturalDirectives: "Ice Age mammoth steppe. Vast snowy tundras, colossal mammoth herds, fur-clad hunter-gatherers, and campfire caves.",
      examples: {
        wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a vast prehistoric tundra valley, colossal woolly mammoths grazing across the snowy steppe, tiny stickman hunters gathered around a distant campfire near glacial cliffs, bold black outlines, flat solid colors.",
        birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a prehistoric tribal campsite, mammoth-hide tents encircling a central stone fire pit, meat drying racks, tiny stick figures crafting tools, bold black outlines, flat solid colors.",
        visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section of a prehistoric cave shelter, showing outer fire pit sentry area, inner sleeping furs, cave wall doodle paintings, stickmen demonstrating tasks, clean diagram layout, bold outlines, flat solid colors.",
        characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of three prehistoric hunter stickmen in thick fur pelts tracking animal tracks across a snowy ridge, distant mountain peaks in the wide background, bold black outlines, flat solid colors."
      }
    };
  }

  // 5. FUTURE / SCI-FI
  if (eraId === "scifi") {
    if (isCambodia) {
      return {
        eraTitle: "🚀 Future / Sci-Fi (Neo-Khmer Solarpunk)",
        regionTitle: "🇰🇭 Cambodia / Solarpunk",
        attire: "Sleek lightweight solar-weave smart tunic with subtle krama pattern accents, magnetic sandals, AR smart glasses",
        hair: "Styled futuristic crop with glowing cyber hair clip",
        props: "Floating delivery drone, solar Mekong water purifier, holographic palm-leaf datapad",
        environment: "Futuristic floating solar cities along the Tonle Sap, vertical hydroponic bamboo towers, sleek automated sky-tuktuks",
        culturalDirectives: "Neo-Khmer solarpunk aesthetic. Tropical green smart architecture, floating river habitats, and sustainable tech.",
        examples: {
          wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a futuristic solar-powered floating city along a wide tropical river, vertical bamboo bio-towers, automated sky-tuktuks flying between platforms, tiny stick figures walking, bold black outlines, flat solid colors.",
          birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of an automated floating agricultural ring on the lake, robotic harvesting drones tending hydroponic lotus crops, tiny stick figures monitoring control panels, bold black outlines, flat solid colors.",
          visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section of a futuristic floating eco-dome home, showing rooftop solar panels, rainwater filtration, and living quarters, clean educational layout, bold outlines, flat solid colors.",
          characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of a futuristic engineer stickman holding a glowing holographic tablet beside a docked automated river skiff, solar towers in background, bold black outlines, flat solid colors."
        }
      };
    }
    return {
      eraTitle: "🚀 Future / Sci-Fi (Cyberpunk & Space Age)",
      regionTitle: "🌍 Global Sci-Fi",
      attire: "Sleek minimalist form-fitting tech jumpsuit, tactical utility belt, magnetic boots",
      hair: "Sleek futuristic haircut, neon-tinted tips, or subtle cybernetic earpiece",
      props: "Glowing holographic datapad, neon UI panels, hovering drone, energy tool",
      environment: "Cyberpunk neon alleys, orbital space stations, hologram servers, Martian geodesic domes",
      culturalDirectives: "Futuristic sci-fi world. Neon cityscapes, orbital space stations, and advanced holographic technologies.",
      examples: {
        wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of a futuristic orbital space station ring overlooking a blue planet, automated transport pods gliding along magnetic rails, tiny stickman astronauts in jumpsuits walking, bold black outlines, flat solid colors.",
        birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a multi-tier cyber city intersection, flying vehicles streaming on light-lanes, neon holographic signs, tiny stick figures traversing pedestrian skybridges, bold black outlines, flat solid colors.",
        visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section of an orbital research module, revealing hydroponic garden, control bridge, gravity centrifuge, and airlock, clean diagram layout, bold outlines, flat solid colors.",
        characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of an astronaut stickman in a tech jumpsuit operating a large glowing holographic star-map terminal in a glass-walled observatory, outer space in background, bold black outlines, flat solid colors."
      }
    };
  }

  // 6. DYSTOPIAN
  return {
    eraTitle: "☢️ Dystopian (Post-Apocalyptic Survival)",
    regionTitle: isCambodia ? "🇰🇭 Cambodia / Post-Apocalyptic" : "🌍 Global Wasteland",
    attire: "Scavenged patchwork duster coat, ragged wrapped scarf, utility straps, combat boots",
    hair: "Windblown dusty hair, protective fabric bandana or goggles pushed onto forehead",
    props: "Geiger counter, solar battery pack, cracked salvage tools, water filter canteen",
    environment: "Bleak post-apocalyptic wastelands, overgrown concrete ruins, salvage bunkers, makeshift watchtowers",
    culturalDirectives: "Post-apocalyptic survival wasteland. Overgrown ruins, improvised settlements, and scavenged technology.",
    examples: {
      wideOverview: "Minimalist 2D flat vector illustration, expansive panoramic wide overview of an overgrown ruined city reclaimed by wild nature, crumbling concrete towers draped in vines, tiny stickman scavenger silhouettes walking along a cracked highway, bold black outlines, flat solid colors.",
      birdsEyeView: "Minimalist 2D flat vector illustration, high-angle aerial bird's-eye view of a fortified survivor outpost, corrugated metal barriers enclosing salvage workshops, solar battery banks, and watchtowers with tiny stick figures, bold black outlines, flat solid colors.",
      visualDiagram: "Minimalist 2D flat vector educational diagram, cutaway cross-section of an underground fallout bunker shelter, showing air filtration pump, hydroponic food tank, and bunk quarters, clean diagram layout, bold outlines, flat solid colors.",
      characterAction: "Minimalist 2D flat vector stickman illustration, wide shot of two survivor stickmen with backpacks and goggles inspecting a salvaged solar generator, vast overgrown wasteland hills in the wide background, bold black outlines, flat solid colors."
    }
  };
}

// Art style presets: drive the core style formula, character design and negative prompt in the scene prompt
type ArtStyle = {
  id: string;
  label: string;
  mood: string;
  bestFor: string;
  formula: string;
  character: string;
  negative: string;
  shading: boolean; // true when the style intentionally uses texture/shading (disables the "zero shading" language)
};

const ART_STYLES: ArtStyle[] = [
  {
    id: "stickman",
    label: "Stickman Doodle",
    mood: "Friendly, clear, explainer-style",
    bestFor: "Educational explainers, history, how-things-work",
    formula: "Minimalist 2D flat vector stickman doodle illustration, clean thick bold black marker outlines, flat solid color fills, zero shading, zero gradients, zero shadows, pure simple minimalist shapes",
    character: `- Round circle head filled with simple skin tone.
- Two large round white cartoon eyes with black dot pupils.
- Simple expressive line eyebrows and mouth (e.g. smiling, wide shock, determined).
- Simple rounded torso wearing flat-colored attire: {attire}.
- Thin black stick-line arms and legs (pure stickman limbs).
- ABSOLUTELY NO muscular detail, NO realistic face, NO gritty comic book shading, NO crosshatching.`,
    negative: "comic book, gritty, realistic, muscular, detailed anatomy, 3D, render, shading, gradients, shadows, photorealistic",
    shading: false,
  },
  {
    id: "anime",
    label: "Anime",
    mood: "Expressive, vibrant, cinematic",
    bestFor: "Drama, adventure, modern stories, youth audiences",
    formula: "Japanese anime illustration, clean crisp line art, cel-shaded flat color with soft two-tone shadows, vibrant saturated palette, expressive large eyes, painterly anime background, soft cinematic lighting, Studio-quality key visual",
    character: `- Anime-proportioned characters (slightly stylized, large expressive eyes, simple detailed hair with highlights, small nose and mouth).
- Dynamic, readable poses and clear emotion in the face and body language.
- Cel-shaded clothing in flat colors with simple fold lines, wearing: {attire}.
- Consistent character design (hair, outfit, colors) across every scene.
- NO photorealistic skin, NO western comic style, NO 3D render look.`,
    negative: "photorealistic, 3D render, western comic, deformed hands, extra fingers, bad anatomy, blurry, lowres, muddy colors",
    shading: true,
  },
  {
    id: "gothic_noir",
    label: "Gothic Noir",
    mood: "Paranoia, mystery, dread",
    bestFor: "Detective stories, urban crime, psychological horror",
    formula: "Gothic noir graphic illustration, high-contrast black and white with deep ink shadows, dramatic chiaroscuro, long cast shadows, rain-slicked streets, fog and moody backlight, single accent color (muted red or sickly yellow), angular architecture",
    character: `- Silhouetted figures with sharp angular shapes, long coats and hats, faces half-hidden in shadow, wearing: {attire}.
- Dramatic low-key lighting; characters often backlit or lit by a single lamp or window.
- Minimal facial detail; mood is carried by posture and shadow.
- NO bright cheerful colors, NO cartoon faces.`,
    negative: "bright cheerful colors, pastel, cartoon, cute, flat even lighting, photorealistic, text, watermark",
    shading: true,
  },
  {
    id: "paper_cutout",
    label: "Paper Cutout",
    mood: "Fable-like, nostalgic, theatrical",
    bestFor: "Folktales, oral histories, children's fables",
    formula: "Layered paper cutout collage illustration, handmade cut paper shapes with visible paper grain and subtle edge shadows between layers, stage-like diorama depth, warm limited color palette, theatrical staging",
    character: `- Characters built from simple cut paper shapes (round head, folded-paper clothing, jointed limbs), wearing: {attire}.
- Visible layering: each element sits on its own paper layer with a soft drop shadow.
- Simple dot or cut-out eyes, minimal expression.
- NO glossy surfaces, NO digital gradients, NO photorealism.`,
    negative: "photorealistic, glossy, 3D render, digital gradients, thin line art, neon, text, watermark",
    shading: true,
  },
  {
    id: "soft_geometric",
    label: "Soft Geometric",
    mood: "Warm, earnest, emotionally disarming",
    bestFor: "Coming-of-age, interpersonal dramedy, fantasy adventures",
    formula: "Soft geometric flat illustration, rounded simple shapes (circles, soft rectangles, arcs), warm harmonious pastel palette, gentle subtle grain, no outlines, calm balanced composition, friendly storybook feel",
    character: `- Characters made of rounded geometric forms: circle head, soft pill-shaped body, tiny dot eyes and gentle smile, wearing: {attire}.
- No outlines; shapes defined by color blocks only.
- Warm, gentle expressions and cozy body language.
- NO sharp edges, NO realistic anatomy, NO harsh shadows.`,
    negative: "outlines, sharp edges, harsh shadows, photorealistic, gritty, realistic anatomy, dark, text, watermark",
    shading: false,
  },
  {
    id: "woodblock",
    label: "Woodblock / Linocut",
    mood: "Archaic, heavy, fateful",
    bestFor: "Historical chronicles, mythic legends, grim fables",
    formula: "Woodblock print and linocut illustration, bold carved black lines, rough hand-carved texture, limited palette of 2-3 flat ink colors on aged paper, visible ink irregularities, strong graphic composition, stylized mythic imagery",
    character: `- Stylized, heavy-set figures with carved angular outlines and solid ink fills, wearing: {attire}.
- Hatching and gouge marks used for shadows and folds.
- Solemn, monumental poses like a historical chronicle plate.
- NO soft gradients, NO photorealism, NO digital polish.`,
    negative: "photorealistic, soft gradients, digital polish, neon colors, 3D render, anime, text, watermark",
    shading: true,
  },
  {
    id: "watercolor",
    label: "Watercolor Sketch",
    mood: "Poetic, fragile, bittersweet",
    bestFor: "Memoirs, philosophical shorts, childhood memories",
    formula: "Loose watercolor and ink sketch illustration, soft bleeding washes, delicate pencil and ink linework, visible paper texture, muted faded palette, unpainted white paper edges, dreamy atmospheric light",
    character: `- Gently sketched figures with loose ink lines and translucent watercolor washes, wearing: {attire}.
- Soft, slightly imperfect proportions; faces simple and tender.
- Color bleeds past the outlines in places.
- NO hard digital edges, NO saturated neon colors, NO photorealism.`,
    negative: "hard digital edges, neon, photorealistic, 3D render, heavy black outlines, vector flat, text, watermark",
    shading: true,
  },
  {
    id: "low_poly",
    label: "Low-Poly Geometric",
    mood: "Analytical, stark, futuristic",
    bestFor: "Cyberpunk, mathematical metaphors, dystopian narratives",
    formula: "Low-poly geometric illustration, faceted triangular polygons, flat-shaded facets with sharp angular edges, cold limited palette with neon accent glow, stark minimalist composition, clean digital look",
    character: `- Characters modeled from visible triangular facets with simple angular faces, wearing: {attire}.
- Flat-shaded polygons; each facet a single color, no smooth blending.
- Stark, still poses suggesting a cold, analytical world.
- NO organic curves, NO realistic textures, NO hand-drawn look.`,
    negative: "organic curves, smooth gradients, realistic textures, hand-drawn, watercolor, photorealistic, text, watermark",
    shading: true,
  },
];

// Preset Atmosphere & Solid Backdrop Color Palettes (Pure Studio White as default)
const MOOD_OPTIONS = [
  { id: "pure_white", label: "Pure Studio White", shortLabel: "Pure White", color: "#ffffff", desc: "Crisp clean pure white background, signature YouTube explainer aesthetic" },
  { id: "pale_ice", label: "Pale Ice Blue", shortLabel: "Ice Blue", color: "#e0f2fe", desc: "Chilly crisp light blue, isolated and analytical" },
  { id: "parchment_cream", label: "Parchment Cream", shortLabel: "Parchment", color: "#fef3c7", desc: "Warm antique parchment, historical and academic" },
  { id: "muted_sand", label: "Muted Sand", shortLabel: "Muted Sand", color: "#f5ebe0", desc: "Warm desert earth, prehistoric and rugged" },
  { id: "slate_navy", label: "Slate Navy", shortLabel: "Slate Navy", color: "#1e293b", desc: "Deep dark navy blue, contemplative and serious" },
  { id: "dark_crimson", label: "Dark Crimson", shortLabel: "Dark Crimson", color: "#450a0a", desc: "Deep brooding burgundy, conflict and danger" },
];

// Preset Scene Staging options
const SCENE_STAGING_OPTIONS = [
  { 
    id: "studio", 
    label: "Studio Canvas (Seamless)", 
    shortLabel: "Studio Canvas",
    sub: "Grounded with floor contact shadow on seamless white/solid backdrop",
    desc: "Character & key props grounded with subtle floor shadow on seamless backdrop" 
  },
  { 
    id: "environment", 
    label: "Full Environment", 
    shortLabel: "Environment",
    sub: "Full-bleed 2D illustrated setting filling the entire canvas",
    desc: "Rich 2D illustrated setting filling the canvas edge-to-edge without border cutouts" 
  },
];

// Preset Video Aspect Ratio options matching Google Flow
const ASPECT_RATIO_OPTIONS = [
  { id: "16:9", label: "16:9", sub: "Widescreen", desc: "16:9 widescreen landscape composition, full-bleed framing" },
  { id: "4:3", label: "4:3", sub: "Standard", desc: "4:3 standard balanced composition, full-bleed framing" },
  { id: "1:1", label: "1:1", sub: "Square", desc: "1:1 square centered composition, full-bleed framing" },
  { id: "3:4", label: "3:4", sub: "Vertical", desc: "3:4 vertical composition, full-bleed framing" },
  { id: "9:16", label: "9:16", sub: "Portrait / Shorts", desc: "9:16 vertical orientation, full-bleed vertical composition" },
];

// Graphic Wireframe Icon for Aspect Ratios matching Google Flow UI
function AspectRatioGraphic({ ratio, className = "" }: { ratio: string; className?: string }) {
  switch (ratio) {
    case "16:9":
      return <div className={`w-[18px] h-[10px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "4:3":
      return <div className={`w-[15px] h-[11px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "1:1":
      return <div className={`w-[12px] h-[12px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "3:4":
      return <div className={`w-[11px] h-[15px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "9:16":
      return <div className={`w-[10px] h-[18px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    default:
      return <div className={`w-[14px] h-[10px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
  }
}

// Auto-resizing textarea to display full scene detail with NO internal scrollbars
function AutoResizeTextarea({
  defaultValue,
  onBlur,
  className,
  placeholder,
  disabled = false,
  onChange,
}: {
  defaultValue: string;
  onBlur: (val: string) => void;
  className: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const [val, setVal] = useState(defaultValue || "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVal(defaultValue || "");
  }, [defaultValue]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(ref.current.scrollHeight, 24)}px`;
    }
  }, [val]);

  return (
    <textarea
      ref={ref}
      value={val}
      disabled={disabled}
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => { setVal(e.target.value); onChange?.(e.target.value); }}
      onBlur={() => {
        if (val !== (defaultValue || "")) {
          onBlur(val);
        }
      }}
      placeholder={placeholder}
      className={`${className} overflow-hidden resize-none select-text cursor-text`}
      rows={1}
    />
  );
}

export default function BrainstormingTab({ activeProject, refreshProjectData }: BrainstormingTabProps) {
  const { updateActiveProject, updateSingleScene, reorderScenes } = useProjectContext();
  const [planningImageId, setPlanningImageId] = useState<number | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const hasActiveVideoJobs = (activeProject?.scenes || []).some((scene: any) => scene.video_status === "queued" || scene.video_status === "processing");
  const handlePlanImage = async (sceneId: number) => {
    setPlanningImageId(sceneId);
    setPlanningError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/plan-image`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Could not plan the scene image.");
      await refreshProjectData?.();
    } catch (error) { setPlanningError(error instanceof Error ? error.message : "Could not plan the scene image."); }
    finally { setPlanningImageId(null); }
  };

  const [draggedSceneIdx, setDraggedSceneIdx] = useState<number | null>(null);
  const [dragOverSceneIdx, setDragOverSceneIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
  const [dragHandleActiveIdx, setDragHandleActiveIdx] = useState<number | null>(null);

  const handleSceneDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSceneIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleSceneDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedSceneIdx === null || draggedSceneIdx === index) {
      setDragOverSceneIdx(null);
      setDropPosition(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";
    setDragOverSceneIdx(index);
    setDropPosition(pos);
  };

  const handleSceneDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSceneIdx === null || draggedSceneIdx === targetIndex) {
      setDraggedSceneIdx(null);
      setDragOverSceneIdx(null);
      setDropPosition(null);
      return;
    }

    const currentScenes = activeProject?.scenes || [];
    const newScenes = [...currentScenes];
    const [draggedItem] = newScenes.splice(draggedSceneIdx, 1);
    
    let insertIndex = targetIndex;
    if (dropPosition === "after" && draggedSceneIdx < targetIndex) {
      insertIndex = targetIndex;
    } else if (dropPosition === "before" && draggedSceneIdx > targetIndex) {
      insertIndex = targetIndex;
    } else if (dropPosition === "after" && draggedSceneIdx > targetIndex) {
      insertIndex = targetIndex + 1;
    } else if (dropPosition === "before" && draggedSceneIdx < targetIndex) {
      insertIndex = targetIndex - 1;
    }
    insertIndex = Math.max(0, Math.min(newScenes.length, insertIndex));
    newScenes.splice(insertIndex, 0, draggedItem);

    const newOrderedIds = newScenes.map((s: any) => s.id);

    setDraggedSceneIdx(null);
    setDragOverSceneIdx(null);
    setDropPosition(null);
    setDragHandleActiveIdx(null);

    if (reorderScenes) {
      await reorderScenes(newOrderedIds);
    }
  };

  const handleSceneDragEnd = () => {
    setDraggedSceneIdx(null);
    setDragOverSceneIdx(null);
    setDropPosition(null);
    setDragHandleActiveIdx(null);
  };

  // Custom dropdown popovers state & click-outside refs
  const [openDropdown, setOpenDropdown] = useState<"era" | "region" | "style" | "staging" | "ratio" | "mood" | "batch" | "batchSize" | null>(null);
  const styleBarRef = useRef<HTMLDivElement>(null);
  const batchDropdownRef = useRef<HTMLDivElement>(null);
  const batchSizeRef = useRef<HTMLDivElement>(null);

  // Collapsible JSON Ingest drawer
  const [isJsonDrawerOpen, setIsJsonDrawerOpen] = useState(false);

  // Collapsible exclusions accordion state per scene
  const [expandedExclusions, setExpandedExclusions] = useState<Record<number, boolean>>({});
  const toggleExclusion = (sceneId: number) => {
    setExpandedExclusions((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }));
  };

  // Local state for creative fields
  const [scriptText, setScriptText] = useState("");
  const [selectedEra, setSelectedEra] = useState("ancient");
  const [selectedRegion, setSelectedRegion] = useState("cambodia");
  const [selectedMood, setSelectedMood] = useState("pure_white");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("16:9");
  const [characterAttire, setCharacterAttire] = useState("");
  const [selectedArtStyle, setSelectedArtStyle] = useState("stickman");
  const [sceneStaging, setSceneStaging] = useState<"studio" | "environment">("studio");
  const [customSetting, setCustomSetting] = useState("");
  const [splitMode, setSplitMode] = useState<"enter" | "sentence">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("script_split_mode");
      if (saved === "enter" || saved === "sentence") return saved;
    }
    return "enter";
  });

  const handleSetSplitMode = (mode: "enter" | "sentence") => {
    setSplitMode(mode);
    try {
      localStorage.setItem("script_split_mode", mode);
    } catch {}
    if (mode === "enter" && scriptText.trim()) {
      const lines = scriptText.split("\n").map((l) => {
        const trimmed = l.replace(/[\s\u200B\uFEFF]+$/g, "");
        if (!trimmed.trim()) return l;
        return trimmed.endsWith("។") || trimmed.endsWith("៕") ? trimmed : `${trimmed}។`;
      });
      const formatted = lines.join("\n");
      if (formatted !== scriptText) {
        setScriptText(formatted);
        if (activeProject?.id) {
          updateActiveProject({ script_narrative: formatted });
        }
      }
    }
  };

  // Batching controller state (Option A: sentence-based, -1 = All Scenes)
  const [batchSize, setBatchSize] = useState(5);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(0);

  // Copy & Modal state
  const [isCopied, setIsCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // JSON Ingestion state
  const [jsonInput, setJsonInput] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // In-App Direct AI Generation & Quick Segmentation state
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenError, setAutoGenError] = useState<string | null>(null);
  const [autoGenSuccess, setAutoGenSuccess] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);

  // Prompt to Script state (Turn Idea/Prompt into full Khmer narrative script)
  const [promptInput, setPromptInput] = useState("");
  const [promptTargetLength, setPromptTargetLength] = useState<"short" | "medium" | "detailed">("medium");
  const [promptDomain, setPromptDomain] = useState<"auto" | "pharmacy" | "teacher_education" | "general">("auto");
  const [promptTone, setPromptTone] = useState<"educational" | "storytelling" | "conversational">("educational");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenError, setScriptGenError] = useState<string | null>(null);
  const [scriptGenSuccess, setScriptGenSuccess] = useState<string | null>(null);
  const [isPromptSectionOpen, setIsPromptSectionOpen] = useState(true);

  // Click-outside listener to close any open dropdown popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isInsideStyleBar = styleBarRef.current && styleBarRef.current.contains(e.target as Node);
      const isInsideBatchDropdown = batchDropdownRef.current && batchDropdownRef.current.contains(e.target as Node);
      const isInsideBatchSize = batchSizeRef.current && batchSizeRef.current.contains(e.target as Node);
      if (!isInsideStyleBar && !isInsideBatchDropdown && !isInsideBatchSize) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync initial project data into local state
  useEffect(() => {
    if (activeProject) {
      setScriptText(activeProject.script_narrative || "");
      if (activeProject.video_concept && !promptInput) {
        setPromptInput(activeProject.video_concept);
      }
      const era = activeProject.theme_era || "ancient";
      const region = activeProject.theme_region || "cambodia";
      setSelectedEra(era);
      setSelectedRegion(region);
      setSelectedMood(activeProject.theme_mood || "pure_white");
      setSelectedAspectRatio(activeProject.aspect_ratio || "16:9");
      setCustomSetting(activeProject.theme_custom || "");
      setSceneStaging((activeProject.scene_staging as any) || "studio");
      setSelectedArtStyle(activeProject.art_style || "stickman");

      const setting = getEraRegionSetting(era, region);
      const defaultAttire = setting ? `${setting.attire}, ${setting.hair}` : "";
      setCharacterAttire(activeProject.character_attire || defaultAttire);
    }
  }, [activeProject?.id]);

  // Sentence / Visual Beat parser:
  // - "enter": split strictly by line breaks (Enter key). Each line is one scene.
  //   For every line that has no ។, append ។ automatically; lines with ។ remain unchanged.
  // - "sentence": split strictly by Khmer full stop (។) and Bariyoosan (៕).
  const sentences = useMemo(() => {
    if (!scriptText.trim()) return [];
    const clean = scriptText.replace(/\(.*?\)/g, "").trim();
    if (splitMode === "enter") {
      const rawLines = clean
        .split(/\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return rawLines.map((s) => {
        const trimmed = s.replace(/[\s\u200B\uFEFF]+$/g, "");
        return trimmed.endsWith("។") || trimmed.endsWith("៕") ? trimmed : `${trimmed}។`;
      }).flatMap((text) => splitNarrationIntoScenes(text));
    } else {
      const rawSentences = clean
        .split(/[។៕]+/)
        .map((s) => s.replace(/\n+/g, " ").replace(/[\s\u200B\uFEFF]+$/g, "").trim())
        .filter((s) => s.length > 0);
      return rawSentences.map((s) => (s.endsWith("។") || s.endsWith("៕") ? s : `${s}។`)).flatMap((text) => splitNarrationIntoScenes(text));
    }
  }, [scriptText, splitMode]);

  // Estimated stats for Khmer & mixed script (words, characters, glyphs, voice duration)
  const scriptStats = useMemo(() => estimateTextStats(scriptText), [scriptText]);

  // Auto-break or format Khmer sentences into lines
  const handleAutoBreakToLines = async () => {
    if (!scriptText.trim()) return;
    let formatted: string;
    if (splitMode === "enter") {
      // For every line that has no ។, append ។ at the end; lines already having ។ remain the way they are
      const lines = scriptText
        .split("\n")
        .map((l) => l.replace(/[\s\u200B\uFEFF]+$/g, "").trim())
        .filter((l) => l.length > 0)
        .map((l) => (l.endsWith("។") || l.endsWith("៕") ? l : `${l}។`));
      formatted = lines.join("\n");
    } else {
      // Split script into separate lines at every Khmer full stop (។ / ៕)
      formatted = scriptText
        .replace(/([។៕])\s*/g, "$1\n")
        .split("\n")
        .map((l) => l.replace(/[\s\u200B\uFEFF]+$/g, "").trim())
        .filter((l) => l.length > 0)
        .map((l) => (l.endsWith("។") || l.endsWith("៕") ? l : `${l}។`))
        .join("\n");
    }
    setScriptText(formatted);
    if (activeProject?.id) {
      await updateActiveProject({ script_narrative: formatted });
    }
  };

  // Calculate batch slices
  const batches = useMemo(() => {
    if (sentences.length === 0) return [];
    const chunks: { index: number; start: number; end: number; items: string[] }[] = [];
    for (let i = 0; i < sentences.length; i += batchSize) {
      const chunk = sentences.slice(i, i + batchSize);
      chunks.push({
        index: chunks.length,
        start: i + 1,
        end: i + chunk.length,
        items: chunk,
      });
    }
    return chunks;
  }, [sentences, batchSize]);

  const isAllScenes = selectedBatchIndex === -1;
  const activeBatch = !isAllScenes ? (batches[selectedBatchIndex] || batches[0] || null) : null;

  // Auto-save script changes on blur
  const handleScriptBlur = async () => {
    if (!activeProject?.id) return;
    let textToSave = scriptText;
    if (splitMode === "enter" && scriptText.trim()) {
      const lines = scriptText.split("\n").map((l) => {
        const trimmed = l.replace(/[\s\u200B\uFEFF]+$/g, "");
        if (!trimmed.trim()) return l;
        return (trimmed.endsWith("។") || trimmed.endsWith("៕")) ? trimmed : `${trimmed}។`;
      });
      textToSave = lines.join("\n");
      if (textToSave !== scriptText) {
        setScriptText(textToSave);
      }
    }
    if (textToSave !== (activeProject.script_narrative || "")) {
      await updateActiveProject({ script_narrative: textToSave });
    }
  };

  // Era selection handler: auto-populates character attire & hair based on Era + Region
  const handleSelectEra = async (eraId: string) => {
    setSelectedEra(eraId);
    const setting = getEraRegionSetting(eraId, selectedRegion);
    const defaultAttire = setting ? `${setting.attire}, ${setting.hair}` : "";
    setCharacterAttire(defaultAttire);
    if (activeProject?.id) {
      await updateActiveProject({ 
        theme_era: eraId,
        character_attire: defaultAttire
      });
    }
  };

  // Region selection handler: auto-populates character attire & hair based on Era + Region
  const handleSelectRegion = async (regionId: string) => {
    setSelectedRegion(regionId);
    const setting = getEraRegionSetting(selectedEra, regionId);
    const defaultAttire = setting ? `${setting.attire}, ${setting.hair}` : "";
    setCharacterAttire(defaultAttire);
    if (activeProject?.id) {
      await updateActiveProject({ 
        theme_region: regionId,
        character_attire: defaultAttire
      });
    }
  };

  // Character attire blur handler
  const handleCharacterAttireBlur = async () => {
    if (!activeProject?.id) return;
    if (characterAttire !== (activeProject.character_attire || "")) {
      await updateActiveProject({ character_attire: characterAttire });
    }
  };

  // Reset character attire to era + region defaults
  const handleResetCharacterAttire = async () => {
    const setting = getEraRegionSetting(selectedEra, selectedRegion);
    const defaultAttire = setting ? `${setting.attire}, ${setting.hair}` : "";
    setCharacterAttire(defaultAttire);
    if (activeProject?.id) {
      await updateActiveProject({ character_attire: defaultAttire });
    }
  };

  // Art style handler: also writes the style formula into the global Illustration Style
  const handleSelectArtStyle = async (styleId: string) => {
    setSelectedArtStyle(styleId);
    const style = ART_STYLES.find((a) => a.id === styleId) || ART_STYLES[0];
    if (activeProject?.id) {
      await updateActiveProject({ art_style: styleId, illustration_style: style.formula });
    }
  };

  // Scene staging handler
  const handleSelectStaging = async (stagingId: "studio" | "environment") => {
    setSceneStaging(stagingId);
    if (activeProject?.id) {
      await updateActiveProject({ scene_staging: stagingId });
    }
  };

  // Mood selection handler
  const handleSelectMood = async (moodId: string) => {
    setSelectedMood(moodId);
    if (activeProject?.id) {
      await updateActiveProject({ theme_mood: moodId });
    }
  };

  // Aspect ratio selection handler
  const handleSelectAspectRatio = async (ratioId: string) => {
    setSelectedAspectRatio(ratioId);
    if (activeProject?.id) {
      await updateActiveProject({ aspect_ratio: ratioId });
    }
  };

  // Custom setting handler
  const handleCustomSettingBlur = async () => {
    if (!activeProject?.id) return;
    if (customSetting !== (activeProject.theme_custom || "")) {
      await updateActiveProject({ theme_custom: customSetting });
    }
  };

  // Build the complete YouTube Thumbnail Frontier Prompt for ChatGPT / Claude / Gemini
  const generateThumbnailPrompt = () => {
    const eraObj = ERA_OPTIONS.find((e) => e.id === selectedEra) || ERA_OPTIONS[0];
    const regionObj = REGION_OPTIONS.find((r) => r.id === selectedRegion) || REGION_OPTIONS[0];
    const eraSetting = getEraRegionSetting(selectedEra, selectedRegion);
    const moodObj = MOOD_OPTIONS.find((m) => m.id === selectedMood) || MOOD_OPTIONS[0];
    const ratioObj = ASPECT_RATIO_OPTIONS.find((r) => r.id === selectedAspectRatio) || ASPECT_RATIO_OPTIONS[0];

    if (sentences.length === 0) {
      return "No script sentences detected. Please paste your Khmer script first.";
    }

    const attireText = characterAttire.trim() || `${eraSetting.attire}, ${eraSetting.hair}`;
    const backdropSpec = moodObj.id === "pure_white" 
      ? "seamless Pure Studio White background" 
      : `seamless ${moodObj.label} (${moodObj.desc}) background`;

    return `You are the Lead YouTube Creative Director and Thumbnail Strategist for top educational explainer channels (specializing in the signature high-engagement visual storytelling of channels like Whatly, Kurzgesagt, and OverSimplified).

Your mission is to analyze the complete video script below, identify its core paradox, and generate high-CTR **YouTube Thumbnail Image Prompts** for our 2D vector stickman diffusion engine (FLUX.1 / Imagen).

---

### 🚨 RULE 1: MANDATORY WHITE BACKGROUND (UNLESS SPECIFIED OTHERWISE):
- The background MUST be: "${backdropSpec}".
- A crisp, clean, seamless pure studio white canvas (signature YouTube animated explainer aesthetic).
- DO NOT draw dark night skies, full-bleed scenic landscapes, or dark color fills unless explicitly asked. The canvas background must remain clean, seamless white.

---

### 🚨 RULE 2: MANDATORY 50/50 ASYMMETRICAL OFFSET (MASSIVE SPACE FOR TEXT):
- The creator will add large bold graphic text / titles in post-production.
- **ALL visual elements, characters, props, and action MUST be clustered strictly on ONE half of the frame (e.g. the right 50% or 60%)**.
- **The opposite half (the left 40% to 50% of the entire widescreen canvas) MUST be completely empty, open, pure white space** with ZERO characters, ZERO props, and ZERO background elements.
- This guarantees a huge, unobstructed clean white area for large thumbnail typography!

---

### 🚨 RULE 3: HOW TO MAKE THE CHARACTER HALF ENGAGING (NOT BORING):
Even though the background is white and half the canvas is empty, the character half must tell a dramatic, exciting, and funny story:
- **Expressive 2D Stickman Characters**: Round circle heads, simple skin tone, large white cartoon eyes with black dot pupils, and thin black stick limbs.
- **Extreme Cartoon Facial Emotions**: Wide jaw-dropped shock, frantic panic with sweat drops, smug mastermind smirk, or wide-eyed confusion.
- **Scale & Story Conflict**: Show a clear visual contrast (e.g. a tiny, clever stickman with an advanced tool/smirk standing next to an oversized, bulky caveman/brute who is sweating or dropping a rock in confusion).
- **Subtle Grounding**: Include a subtle floor contact shadow so characters stand firmly on the studio floor (not awkwardly floating).
- **STRICTLY ZERO TEXT IN AI IMAGE GENERATION**: The image generator must NOT generate letters, words, or captions. All text will be added by the creator later.

---

### 4 PROVEN EXPLAINER THUMBNAIL STORYTELLING FORMULAS (ON WHITE BACKGROUND):
Choose the formulas that best dramatize THIS specific script's story within the character half:
1. **The Scale Paradox (Brains vs Brawn)**: A tiny, clever stickman with an advanced innovation/tool confronting a colossal, bulky rival/brute who is confused, sweating, or struggling.
2. **The Mystery Lineup ("The Last One Standing")**: 2 or 3 characters standing together where one is clearly the odd one out or where rival figures are dissolving into fading dotted ghost outlines.
3. **The Cataclysm / Struggle Dilemma**: One character shivering or struggling under an exaggerated situation, while the clever stickman stands comfortably with the solution.
4. **The Split Comparison**: Two characters side-by-side on the character half showcasing an extreme "Before vs After" or "Them vs Us" contrast.

---

### CORE FLUX PROMPT STRUCTURE:
"Minimalist 2D flat vector animated explainer illustration, clean thick bold black marker outlines, flat vibrant solid colors, ${backdropSpec}, [DRAMATIC CHARACTER ACTION CONFINED STRICTLY TO THE RIGHT HALF OF THE FRAME], [THE ENTIRE LEFT HALF OF THE FRAME IS COMPLETELY EMPTY OPEN PURE WHITE SPACE RESERVED FOR TITLE TEXT OVERLAY], subtle floor contact shadow, ${ratioObj.desc}, strictly no text, zero 3D rendering, zero photorealism"

---

### PROJECT CONFIGURATION & CONTEXT:
- Era: ${eraSetting.eraTitle}.
- Cultural Region: ${regionObj.label} (${regionObj.desc}).
- Cultural Directives: ${eraSetting.culturalDirectives}.
- Character Attire & Hair: ${attireText}.
- Authentic Key Props: ${eraSetting.props}.
- Background: ${backdropSpec}.
- Video Framing / Aspect Ratio: ${ratioObj.label} (${ratioObj.desc}).
${customSetting.trim() ? `- Key Story Elements: ${customSetting.trim()}\n` : ""}
### COMPLETE VIDEO SCRIPT TO ANALYZE:
"""
${scriptText}
"""

---

### STRICT OUTPUT FORMAT (COPY-READY PROMPTS ONLY):
Do NOT output greetings, conversational intros, script analysis commentary, or suggested hook text (the creator will write their own text).
Provide ONLY the 3 options in this exact format, with every prompt in its own code block ready for 1-click copying:

### 🎨 Option 1: [Short Title] (⭐ Top Recommended)
**Scene & Text Space**: [1 short sentence describing the character action on the right half, and confirming the left half is empty open white space for text]

**Prompt to copy:**
\`\`\`text
[The exact 40-65 word FLUX.1 vector prompt, describing the character action on the right, specifying the entire left half is empty open pure white space for text overlay, ${backdropSpec}, subtle floor contact shadow, ${ratioObj.desc}, strictly no text, zero 3D rendering, zero photorealism]
\`\`\`

**Negative prompt:**
\`\`\`text
text, words, letters, labels, alphabet, captions, watermark, dark background, night sky, scenic landscape, clutter, comic book, gritty, realistic, muscular, detailed anatomy, 3D, render, photorealistic
\`\`\`

---

### 🎨 Option 2: [Short Title]
**Scene & Text Space**: [1 short sentence describing the character action on the right half, and confirming the left half is empty open white space for text]

**Prompt to copy:**
\`\`\`text
[The exact 40-65 word FLUX.1 vector prompt, describing the character action on the right, specifying the entire left half is empty open pure white space for text overlay, ${backdropSpec}, subtle floor contact shadow, ${ratioObj.desc}, strictly no text, zero 3D rendering, zero photorealism]
\`\`\`

**Negative prompt:**
\`\`\`text
text, words, letters, labels, alphabet, captions, watermark, dark background, night sky, scenic landscape, clutter, comic book, gritty, realistic, muscular, detailed anatomy, 3D, render, photorealistic
\`\`\`

---

### 🎨 Option 3: [Short Title]
**Scene & Text Space**: [1 short sentence describing the character action on the right half, and confirming the left half is empty open white space for text]

**Prompt to copy:**
\`\`\`text
[The exact 40-65 word FLUX.1 vector prompt, describing the character action on the right, specifying the entire left half is empty open pure white space for text overlay, ${backdropSpec}, subtle floor contact shadow, ${ratioObj.desc}, strictly no text, zero 3D rendering, zero photorealism]
\`\`\`

**Negative prompt:**
\`\`\`text
text, words, letters, labels, alphabet, captions, watermark, dark background, night sky, scenic landscape, clutter, comic book, gritty, realistic, muscular, detailed anatomy, 3D, render, photorealistic
\`\`\``;
  };

  // Build the complete frontier prompt for ChatGPT/Claude
  const generatePrompt = (batchIdx: number = selectedBatchIndex) => {
    if (batchIdx === -2) {
      return generateThumbnailPrompt();
    }

    const eraObj = ERA_OPTIONS.find((e) => e.id === selectedEra) || ERA_OPTIONS[0];
    const regionObj = REGION_OPTIONS.find((r) => r.id === selectedRegion) || REGION_OPTIONS[0];
    const eraSetting = getEraRegionSetting(selectedEra, selectedRegion);
    const moodObj = MOOD_OPTIONS.find((m) => m.id === selectedMood) || MOOD_OPTIONS[0];
    const ratioObj = ASPECT_RATIO_OPTIONS.find((r) => r.id === selectedAspectRatio) || ASPECT_RATIO_OPTIONS[0];

    if (sentences.length === 0) {
      return "No script sentences detected. Please paste your Khmer script first.";
    }

    const isAll = batchIdx === -1;
    const currentBatch = !isAll ? (batches[batchIdx] || batches[0]) : null;

    const startNum = currentBatch ? currentBatch.start : 1;
    const endNum = currentBatch ? currentBatch.end : sentences.length;

    const targetSlice = currentBatch
      ? currentBatch.items.map((s, idx) => `  ${currentBatch.start + idx}. "${s}"`).join("\n")
      : sentences.map((s, idx) => `  ${idx + 1}. "${s}"`).join("\n");

    const taskTitle = currentBatch
      ? `YOUR TARGET TASK (BATCH ${currentBatch.index + 1}: SCENES ${startNum} TO ${endNum})`
      : `YOUR TARGET TASK (ALL SCENES 1 TO ${sentences.length})`;

    const attireText = characterAttire.trim() || `${eraSetting.attire}, ${eraSetting.hair}`;
    const artStyle = ART_STYLES.find((a) => a.id === selectedArtStyle) || ART_STYLES[0];
    const isStickman = artStyle.id === "stickman";
    const stagingInstruction = sceneStaging === "studio"
      ? `Uniform seamless ${moodObj.label} (${moodObj.desc}) background. The character and key story elements are grounded with a clean subtle contact shadow/floor patch. Clean minimalist composition with zero border frames.`
      : `Full-bleed 2D illustrated ${eraSetting.eraTitle} setting filling the frame edge-to-edge. Rich environmental context, vibrant flat colors. NO border margins, NO letterbox frames.`;

    return `You are the lead visual director and storyboard artist for a top-tier educational animated explainer channel in the ${isStickman ? 'signature "Whatly" stickman doodle aesthetic' : `${artStyle.label} aesthetic (${artStyle.mood})`}.

### 1. CORE VISUAL ENGINE DIRECTIVE (LOCAL FLUX ${artStyle.label.toUpperCase()} SPEC):
- Target Image Engine: Local FLUX.1 vector diffusion.
- CRITICAL: DO NOT use the word "Whatly" in the prompts (the model does not recognize proper-noun channel tags).
- CORE STYLE FORMULA: "${artStyle.formula}, ${sceneStaging === 'studio' ? 'seamless ' + moodObj.label + ' studio background' : 'full-bleed flat 2D ' + eraSetting.eraTitle + ' environment'}, ${ratioObj.desc}${isStickman ? ", zero 3D rendering, zero photorealism, zero comic book detail" : ""}".
- PROMPT LENGTH: Concise, punchy, and cinematic (35 to 55 words max).
- NARRATION TIMING: Use natural scene breaks without a fixed narration duration limit. Keep narration exact.
- ALSO WRITE video_prompt: a short image-to-video motion direction describing character action and camera movement from the starting image. Do not change character designs or add speech. Animation duration will be measured from narration in Assembly.

### 2. CHARACTER SPECIFICATION (${isStickman ? "TRUE WHATLY STICKMAN DOODLE" : artStyle.label.toUpperCase()}):
When human characters appear, they MUST follow this design:
${artStyle.character.replace("{attire}", attireText)}

### 3. GOLDEN FRAMING RULES: EXPANSIVE BROAD VIEWS, BIRD'S EYE & DIAGRAMS (NO ISOLATED MACRO OBJECTS!):
- STRICT PROHIBITION ON ISOLATED MACRO CLOSE-UPS: NEVER generate macro close-ups of single isolated objects sitting in the middle of a blank canvas (NO macro bread baskets, NO isolated wax scrolls, NO single tools floating alone). If an object or prop is mentioned in the narration, show it held by an active character in a wider scene, or integrated within an environmental setting or market!
- MANDATORY BROAD & OVERVIEW FRAMING: Default to wide-angle panoramic establishing shots, broad landscape/cityscape overviews, high-angle aerial bird's-eye views, or educational 2D vector diagrams.
- EDUCATIONAL VISUAL DIAGRAMS WELCOMED: When explaining concepts, architectures, social structures, or comparisons, use clean educational diagrams in the chosen art style (e.g. architectural cutaway cross-sections, split-panel before/after comparisons, or step-by-step visual process layouts).
- ZERO TEXT / ZERO WORDS: NEVER request words, letters, labels, or captions. Diffusion models cannot render text. Use only physical objects, structural layouts, and simple visual icons.

### 4. 4 HIGH-ENGAGEMENT BROAD SHOT TYPES:
Cycle through these 4 physical shot types to keep the storyboard visually dynamic and expansive:
1. WIDE OVERVIEW (PANORAMA): Expansive wide-angle landscape, settlement, market, temple complex, or city boulevard showing the full environment and multiple active characters.
2. BIRD'S EYE VIEW (TOP-DOWN AERIAL): High-angle aerial perspective looking down from above at town layouts, riverways, agricultural fields, irrigation canals, or bustling marketplace pathways.
3. VISUAL DIAGRAM / CUTAWAY: Educational explainer diagram in the chosen art style, split-screen comparison (e.g. left vs right), or architectural cross-section cutaway showing structural levels.
4. CHARACTER ACTION IN BROAD CONTEXT: Wide or medium-wide shot of 2+ characters engaged in physical storytelling (trading, running, building, journeying) with rich environmental backdrop.

### 5. THEME, REGION & SETTING CONTEXT:
- Era: ${eraSetting.eraTitle}.
- Cultural Region: ${regionObj.label} (${regionObj.desc}).
- Cultural Directives: ${eraSetting.culturalDirectives}.
- Character Attire & Hair (WHEN CHARACTERS APPEAR): ${attireText}.
- Typical Setting & Architecture: ${eraSetting.environment}.
- Authentic Key Props: ${eraSetting.props}.
- Backdrop Palette: ${moodObj.label} (${moodObj.desc}).
- Video Framing: ${ratioObj.label} (${ratioObj.desc}).
${customSetting.trim() ? `- Key Story Props / Elements: ${customSetting.trim()}\n` : ""}
### 6. COMPLETE STORY SCRIPT BACKGROUND:
"""
${scriptText}
"""

### 7. ${taskTitle}:
Generate visual scene descriptions ONLY for the following target sentences. Do not skip or combine sentences.
Target sentences:
${targetSlice}

### 8. STRICT JSON OUTPUT FORMAT:
Output MUST be a valid JSON array of objects matching this schema exactly.
Do not wrap in extra conversational markdown text. RETURN ONLY VALID JSON:
[
  {
    "scene_number": ${startNum},
    "narration_khmer": "<exact Khmer sentence from target list>",
    "shot_type": "wide_overview | birds_eye_view | visual_diagram | character_action_wide",
    "image_prompt_english": "<concise 35-55 word prompt describing a CONCRETE broad/overview scene in the ${artStyle.label} style (${artStyle.formula.split(",").slice(0, 3).join(",")}), zero text>",
    "video_prompt": "<motion direction for this starting image; no speech or on-screen text>",
    "negative_prompt": "text, words, letters, labels, alphabet, captions, watermark, signature, macro close-up, isolated single object, ${artStyle.negative}"
  }
]

${isStickman ? `### REFERENCE EXAMPLES FOR ${eraSetting.eraTitle.toUpperCase()} (${regionObj.shortLabel.toUpperCase()}):
- Example Wide Overview: "${eraSetting.examples.wideOverview}"
- Example Bird's Eye View: "${eraSetting.examples.birdsEyeView}"
- Example Visual Diagram / Cutaway: "${eraSetting.examples.visualDiagram}"
- Example Character Action (Broad): "${eraSetting.examples.characterAction}"` : `### STYLE REMINDER:
Every image_prompt_english must begin with the core style formula above and stay in the ${artStyle.label} style. Describe concrete wide/overview scenes for ${eraSetting.eraTitle.toUpperCase()} (${regionObj.shortLabel.toUpperCase()}) only; do not mention stickmen.`}`;
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = async () => {
    const promptText = generatePrompt();
    try {
      await navigator.clipboard.writeText(promptText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  // Validate JSON on the fly
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonInput(val);
    setImportSuccessMessage(null);
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      let clean = val.trim();
      if (clean.startsWith("```")) {
        const lines = clean.split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines.length && lines[lines.length - 1].startsWith("```")) lines.pop();
        clean = lines.join("\n").trim();
      }
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) {
        setJsonError("JSON must be an array of scene objects (e.g. [ { ... }, { ... } ])");
      } else {
        setJsonError(null);
      }
    } catch (err: any) {
      setJsonError("Invalid JSON syntax: " + err.message);
    }
  };

  // Ingest scenes into backend
  const handleImportScenes = async () => {
    if (!jsonInput.trim() || jsonError || !activeProject?.id) return;
    setIsImporting(true);
    setImportSuccessMessage(null);

    let clean = jsonInput.trim();
    if (clean.startsWith("```")) {
      const lines = clean.split("\n");
      if (lines[0].startsWith("```")) lines.shift();
      if (lines.length && lines[lines.length - 1].startsWith("```")) lines.pop();
      clean = lines.join("\n").trim();
    }

    try {
      const parsed = JSON.parse(clean);
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/import-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: parsed,
          mode: importMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setJsonInput("");
        setImportSuccessMessage(`Successfully ${importMode === "append" ? "appended" : "imported"} ${data.imported_count} scenes!`);
        if (refreshProjectData) {
          await refreshProjectData();
        }
        setTimeout(() => setImportSuccessMessage(null), 4000);
      } else {
        const err = await res.text();
        setJsonError("Failed to import: " + err);
      }
    } catch (err: any) {
      setJsonError("Error importing: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Delete scene handler
  const handleDeleteScene = async (sceneId: number) => {
    try {
      const updatedScenes = (activeProject?.scenes || [])
        .filter((s: any) => s.id !== sceneId)
        .map((s: any, idx: number) => ({
          scene_number: idx + 1,
          narration_khmer: s.narration_khmer,
          image_prompt_english: s.image_prompt_english,
          video_prompt: s.video_prompt,
          negative_prompt: s.negative_prompt,
        }));

      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/import-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: updatedScenes,
          mode: "replace",
        }),
      });
      if (refreshProjectData) await refreshProjectData();
    } catch (err) {
      console.error("Error deleting scene:", err);
    }
  };

  // Direct In-App AI Storyboard Generation
  const handleAutoGenerateScenes = async () => {
    if (!scriptText.trim() || !activeProject?.id) return;
    setIsAutoGenerating(true);
    setAutoGenError(null);
    setAutoGenSuccess(null);

    const promptText = generatePrompt(selectedBatchIndex);
    const mode = (selectedBatchIndex === -1 || (activeProject?.scenes || []).length === 0) ? "replace" : "append";

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/auto-generate-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          visual_mode: "images",
          mode: mode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAutoGenSuccess(`✨ Successfully created ${data.imported_count} scenes in Storyboard Deck!`);
        if (refreshProjectData) {
          await refreshProjectData();
        }
        setTimeout(() => setAutoGenSuccess(null), 5000);
      } else {
        const errText = await res.text();
        let message = errText;
        try {
          const parsed = JSON.parse(errText);
          message = parsed.detail || errText;
        } catch {}
        setAutoGenError(message);
      }
    } catch (err: any) {
      setAutoGenError("Failed to auto-generate: " + err.message);
    } finally {
      setIsAutoGenerating(false);
    }
  };

  // Generate full Khmer narrative script from prompt/idea
  const handleGenerateScriptFromPrompt = async (customPrompt?: string) => {
    const p = (customPrompt !== undefined ? customPrompt : promptInput).trim();
    if (!p) {
      setScriptGenError("Please enter a topic or prompt first.");
      return;
    }
    if (!activeProject?.id) {
      setScriptGenError("No active project found.");
      return;
    }

    if (scriptText.trim().length > 30) {
      const ok = window.confirm(
        "Generate new script from prompt? This will replace your current narrative script."
      );
      if (!ok) return;
    }

    setIsGeneratingScript(true);
    setScriptGenError(null);
    setScriptGenSuccess(null);

    try {
      const res = await fetch(
        `http://localhost:8000/api/projects/${activeProject.id}/generate-script-from-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: p,
            target_length: promptTargetLength,
            domain: promptDomain,
            tone: promptTone,
            language: "khmer",
            apply_to_project: true,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to generate script");
      }

      const data = await res.json();
      setScriptText(data.script_narrative);
      setScriptGenSuccess(`✨ Generated ${data.scene_count} scenes (${data.detected_domain}) successfully!`);
      if (refreshProjectData) {
        await refreshProjectData();
      }
      setTimeout(() => setScriptGenSuccess(null), 5000);
    } catch (err: any) {
      setScriptGenError(err.message || "Script generation failed.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Direct 1-Click Quick Split Lines into Scenes (No AI required)
  const handleQuickSplitScenes = async () => {
    if (!scriptText.trim() || !activeProject?.id) return;
    setIsSplitting(true);
    setAutoGenError(null);
    setAutoGenSuccess(null);

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/segment-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          long_script: scriptText,
          split_mode: splitMode,
        }),
      });

      if (res.ok) {
        setAutoGenSuccess("⚡ Split script lines directly into scenes!");
        if (refreshProjectData) {
          await refreshProjectData();
        }
        setTimeout(() => setAutoGenSuccess(null), 4000);
      } else {
        const err = await res.text();
        setAutoGenError("Failed to segment: " + err);
      }
    } catch (err: any) {
      setAutoGenError("Error segmenting: " + err.message);
    } finally {
      setIsSplitting(false);
    }
  };

  const scenes = activeProject?.scenes || [];
  const currentEra = ERA_OPTIONS.find((e) => e.id === selectedEra) || ERA_OPTIONS[0];
  const currentRegion = REGION_OPTIONS.find((r) => r.id === selectedRegion) || REGION_OPTIONS[0];
  const currentMood = MOOD_OPTIONS.find((m) => m.id === selectedMood) || MOOD_OPTIONS[0];

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)] max-h-[calc(100vh-56px-48px)] animate-in fade-in duration-200">
      
      <div className="shrink-0 rounded-xl border border-border/70 bg-card p-3 mb-3 space-y-1">
        <p className="text-xs font-semibold">Storyboard → Images → Voice → Animate in Assembly</p>
        <p className="text-[11px] text-panel-text">Plan an image and motion direction for each short scene. Use natural narration breaks; longer voiceovers are supported. Generate the image and voice first, then animate to the voiceover duration in Assembly.</p>
        {planningError && <p role="alert" className="text-[11px] text-red-500">{planningError}</p>}
      </div>

      {/* ========================================================= */}
      {/* MAIN WORKSPACE: PLAIN ON BACKGROUND (NO GIANT OUTER BOXES)*/}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 min-h-0 pt-1">
        
        {/* ======================================================= */}
        {/* SCRIPT STUDIO (LEFT COLUMN)                             */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full pr-1 overflow-y-auto custom-scrollbar">
          {/* Header Bar */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <PenLine size={14} strokeWidth={1.8} className="text-primary" />
                <span className="text-[12px] font-bold text-foreground uppercase tracking-wider truncate">
                  Narrative Script (Khmer)
                </span>
              </div>
              <span className="text-[10px] font-semibold text-panel-text bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md shrink-0">
                {sentences.length} {splitMode === "enter" ? (sentences.length === 1 ? "Line" : "Lines") : (sentences.length === 1 ? "Sentence" : "Sentences")}
              </span>
            </div>

            {/* Split Mode Options & Auto-Break */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Mode Selector */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-0.5 rounded-lg border border-border/60 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => handleSetSplitMode("enter")}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                    splitMode === "enter"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Break sentences by line (Enter). Automatically appends '។' to lines without it."
                >
                  By Enter ↵
                </button>
                <button
                  type="button"
                  onClick={() => handleSetSplitMode("sentence")}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                    splitMode === "sentence"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Break sentences by Khmer full stop (។)"
                >
                  By ។
                </button>
              </div>

              {/* Auto-Break to Lines */}
              <button
                type="button"
                onClick={handleAutoBreakToLines}
                className="text-[10px] font-medium text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all border border-primary/20 shadow-2xs"
                title={
                  splitMode === "enter"
                    ? "Format lines: auto-append '។' to any line missing it"
                    : "Automatically split sentences into separate lines at every Khmer full stop (។)"
                }
              >
                <CornerDownLeft size={11} /> Auto-Break
              </button>
            </div>
          </div>

          {/* AI Prompt-to-Script Studio (Step 1: Idea / Topic to Narration) */}
          <div className="shrink-0 mb-2.5 bg-card rounded-xl border border-border/80 shadow-2xs overflow-hidden transition-all">
            {/* Collapsible Header */}
            <div
              onClick={() => setIsPromptSectionOpen(!isPromptSectionOpen)}
              className="px-3 py-2 bg-zinc-50/70 dark:bg-zinc-900/60 border-b border-border/50 flex items-center justify-between cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-colors select-none"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles size={12} className={isGeneratingScript ? "animate-spin text-primary" : "text-primary"} />
                </div>
                <span className="text-[11.5px] font-bold text-foreground">
                  ✨ Prompt to Script (AI Writer)
                </span>
                <span className="text-[10px] text-panel-text hidden sm:inline">
                  — Turn topic or lesson prompt directly into Khmer narration
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-panel-text text-[11px]">
                <span className="text-[10px] font-medium text-primary">
                  {isPromptSectionOpen ? "Collapse" : "Open Generator"}
                </span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${isPromptSectionOpen ? "rotate-180" : ""}`}
                />
              </div>
            </div>

            {/* Expanded Body */}
            {isPromptSectionOpen && (
              <div className="p-3 space-y-2.5">
                {/* Prompt Textarea */}
                <div>
                  <textarea
                    rows={2}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Describe your lesson topic, question, or scenario (e.g. របៀបគ្រប់គ្រងឱសថស្ថាននៅកម្ពុជា ឬ How to counsel patients on antibiotic use)..."
                    className="w-full bg-background border border-border/70 rounded-lg p-2.5 text-[13px] text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-primary/60 resize-none transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleGenerateScriptFromPrompt();
                      }
                    }}
                  />
                </div>

                {/* Quick Topic Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-[10.5px]">
                  <span className="text-panel-text font-semibold flex items-center gap-1 shrink-0">
                    <Lightbulb size={11} className="text-amber-500" /> Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPromptInput("ការគ្រប់គ្រងឱសថស្ថានសហគមន៍នៅកម្ពុជា និងស្តង់ដារ GPP ក្នុងការផ្តល់ប្រឹក្សាឱសថ");
                      setPromptDomain("pharmacy");
                    }}
                    className="shrink-0 px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    💊 Pharmacy: Community GPP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromptInput("ការប្រើប្រាស់ថ្នាំ Paracetamol និងកម្រិត dosage សុវត្ថិភាពសម្រាប់មនុស្សចាស់ និងកុមារ");
                      setPromptDomain("pharmacy");
                    }}
                    className="shrink-0 px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    💊 Safe Paracetamol Dose
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromptInput("វិធីសាស្ត្របង្រៀនសកម្ម (Active Learning) សម្រាប់ថ្នាក់រៀនបឋមសិក្សា");
                      setPromptDomain("teacher_education");
                    }}
                    className="shrink-0 px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    📚 Pedagogy: Active Learning
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromptInput("យុទ្ធសាស្ត្រវាយតម្លៃស្ថាបនា (Formative Assessment) ដោយមិនបាច់ប្រឡងក្រដាស");
                      setPromptDomain("teacher_education");
                    }}
                    className="shrink-0 px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    📚 Formative Checks
                  </button>
                </div>

                {/* Configuration Row & Action */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/40">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Target Length */}
                    <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-border/60 text-[10.5px]">
                      <button
                        type="button"
                        onClick={() => setPromptTargetLength("short")}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                          promptTargetLength === "short" ? "bg-card text-foreground font-semibold shadow-2xs" : "text-panel-text hover:text-foreground"
                        }`}
                        title="~30-45s, 4-6 scenes"
                      >
                        Short (~30s)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromptTargetLength("medium")}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                          promptTargetLength === "medium" ? "bg-card text-foreground font-semibold shadow-2xs" : "text-panel-text hover:text-foreground"
                        }`}
                        title="~1-2m, 8-12 scenes"
                      >
                        Standard (1-2m)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromptTargetLength("detailed")}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                          promptTargetLength === "detailed" ? "bg-card text-foreground font-semibold shadow-2xs" : "text-panel-text hover:text-foreground"
                        }`}
                        title="~3m+, 14-18 scenes"
                      >
                        Detailed (3m+)
                      </button>
                    </div>

                    {/* Domain */}
                    <select
                      value={promptDomain}
                      onChange={(e) => setPromptDomain(e.target.value as any)}
                      className="bg-card border border-border/60 rounded-lg px-2 py-1 text-[11px] text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="auto">Domain: Auto-Detect</option>
                      <option value="pharmacy">💊 Pharmacy & Medical</option>
                      <option value="teacher_education">📚 Pedagogy & Teaching</option>
                      <option value="general">🌍 General Explainer</option>
                    </select>

                    {/* Tone */}
                    <select
                      value={promptTone}
                      onChange={(e) => setPromptTone(e.target.value as any)}
                      className="bg-card border border-border/60 rounded-lg px-2 py-1 text-[11px] text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="educational">Tone: Instructional</option>
                      <option value="storytelling">Tone: Storytelling</option>
                      <option value="conversational">Tone: Direct Counseling</option>
                    </select>
                  </div>

                  {/* Generate Button */}
                  <button
                    type="button"
                    disabled={isGeneratingScript || !promptInput.trim()}
                    onClick={() => handleGenerateScriptFromPrompt()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm transition-all"
                  >
                    {isGeneratingScript ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Writing Script...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>Write Script (AI)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Feedback Alerts */}
                {scriptGenError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-500/10 px-2.5 py-1.5 rounded-lg">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{scriptGenError}</span>
                  </div>
                )}
                {scriptGenSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>{scriptGenSuccess}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clean Writing Paper / Canvas (Box only where necessary!) */}
          <div className="flex-1 flex flex-col min-h-[260px] bg-card rounded-xl border border-border/80 shadow-2xs p-4 my-2 focus-within:border-primary/50 transition-all overflow-hidden">
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              onBlur={handleScriptBlur}
              placeholder={
                splitMode === "enter"
                  ? "Type or paste your narrative script here. Each line (Enter ↵) becomes an individual sentence/scene (missing '។' is appended automatically)..."
                  : "Paste your research script here... Each Khmer full stop (។) breaks into a separate sentence/scene."
              }
              className="w-full flex-1 min-h-[160px] bg-transparent text-[15px] text-foreground leading-relaxed placeholder:text-zinc-400/40 focus:outline-none resize-none custom-scrollbar"
            />

            {/* Real-time Khmer & Multilingual Word/Char Status Bar */}
            <div className="pt-2.5 mt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-panel-text shrink-0 select-none">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex items-center gap-1" title="Estimated word count (using native unspaced Khmer dictionary & multilingual segmentation)">
                  <span className="font-semibold text-foreground">~{scriptStats.words.toLocaleString()}</span>
                  <span>words</span>
                </span>
                <span className="text-border/80">•</span>
                <span className="flex items-center gap-1" title={`${scriptStats.charactersNoSpaces.toLocaleString()} characters excluding spaces`}>
                  <span className="font-semibold text-foreground">{scriptStats.characters.toLocaleString()}</span>
                  <span>chars</span>
                  <span className="text-[9.5px] opacity-70">({scriptStats.charactersNoSpaces.toLocaleString()} no spaces)</span>
                </span>
                {scriptStats.graphemes > 0 && scriptStats.graphemes !== scriptStats.characters && (
                  <>
                    <span className="text-border/80">•</span>
                    <span className="flex items-center gap-1" title="Visual glyphs / graphemes (combining Khmer consonants, sub-consonants, and vowels into single visual units)">
                      <span className="font-semibold text-foreground">{scriptStats.graphemes.toLocaleString()}</span>
                      <span>glyphs</span>
                    </span>
                  </>
                )}
              </div>

              {scriptStats.words > 0 && (
                <div 
                  className="flex items-center gap-1.5 font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md"
                  title="Estimated voiceover reading duration at normal narration pace (~135 wpm)"
                >
                  <Clock size={11} />
                  <span>~{scriptStats.formattedDuration} est. voice</span>
                </div>
              )}
            </div>
          </div>

          {/* Clean Minimalist Style Bar with Custom Upward-Popping Dropdowns */}
          <div ref={styleBarRef} className="py-2 flex items-center justify-between gap-2 text-xs flex-wrap shrink-0 border-t border-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Custom Era Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "era" ? null : "era")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "era" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select narrative era and setting"
                >
                  <span className="text-panel-text font-normal text-[11px]">Era:</span>
                  <span>{currentEra.shortLabel || currentEra.label}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "era" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "era" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[270px] max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Narrative Era & Setting
                    </div>
                    <div className="space-y-0.5">
                      {ERA_OPTIONS.map((era) => {
                        const isSelected = selectedEra === era.id;
                        return (
                          <button
                            key={era.id}
                            type="button"
                            onClick={() => {
                              handleSelectEra(era.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="pr-2 min-w-0">
                              <div className="text-[11px] font-semibold flex items-center gap-1.5 truncate">
                                {era.label}
                              </div>
                              <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">
                                {era.desc}
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Custom Region Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "region" ? null : "region")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "region" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select cultural region & country setting"
                >
                  <span className="text-panel-text font-normal text-[11px]">Region:</span>
                  <span>{currentRegion.shortLabel || currentRegion.label}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "region" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "region" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[280px] max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Cultural Region & Country
                    </div>
                    <div className="space-y-0.5">
                      {REGION_OPTIONS.map((reg) => {
                        const isSelected = selectedRegion === reg.id;
                        return (
                          <button
                            key={reg.id}
                            type="button"
                            onClick={() => {
                              handleSelectRegion(reg.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="pr-2 min-w-0">
                              <div className="text-[11px] font-semibold flex items-center gap-1.5 truncate">
                                {reg.label}
                              </div>
                              <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">
                                {reg.desc}
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Art Style Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "style" ? null : "style")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "style" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select image art style"
                >
                  <span className="text-panel-text font-normal text-[11px]">Style:</span>
                  <span>{(ART_STYLES.find((a) => a.id === selectedArtStyle) || ART_STYLES[0]).label}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "style" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "style" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[300px] max-h-[320px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Image Art Style
                    </div>
                    <div className="space-y-0.5">
                      {ART_STYLES.map((st) => {
                        const isSelected = selectedArtStyle === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              handleSelectArtStyle(st.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="pr-2 min-w-0">
                              <div className="text-[11px] font-semibold truncate">{st.label} <span className="font-normal text-panel-text">· {st.mood}</span></div>
                              <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">{st.bestFor}</div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Custom Staging Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "staging" ? null : "staging")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "staging" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select scene staging style"
                >
                  <span className="text-panel-text font-normal text-[11px]">Staging:</span>
                  <span>{sceneStaging === "studio" ? "Studio Canvas" : "Environment"}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "staging" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "staging" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[270px] max-h-[220px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Scene Staging Style
                    </div>
                    <div className="space-y-0.5">
                      {SCENE_STAGING_OPTIONS.map((st) => {
                        const isSelected = sceneStaging === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              handleSelectStaging(st.id as any);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="pr-2 min-w-0">
                              <div className="text-[11px] font-semibold truncate">
                                {st.label}
                              </div>
                              <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">
                                {st.sub}
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Custom Aspect Ratio Dropdown with Graphic matching Google Flow */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "ratio" ? null : "ratio")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "ratio" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select video aspect ratio matching Google Flow"
                >
                  <span className="text-panel-text font-normal text-[11px]">Ratio:</span>
                  <AspectRatioGraphic ratio={selectedAspectRatio} className="text-primary" />
                  <span>{selectedAspectRatio}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "ratio" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "ratio" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2.5 min-w-[250px] max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-1 pb-1.5 border-b border-border/40 mb-1.5">
                      Google Flow Aspect Ratio
                    </div>
                    
                    {/* Horizontal 5-graphic strip matching Google Flow UI */}
                    <div className="grid grid-cols-5 gap-1 p-1 bg-background/80 dark:bg-zinc-900/50 rounded-lg mb-2 border border-border/40">
                      {ASPECT_RATIO_OPTIONS.map((opt) => {
                        const isSelected = selectedAspectRatio === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              handleSelectAspectRatio(opt.id);
                              setOpenDropdown(null);
                            }}
                            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md cursor-pointer transition-all ${
                              isSelected
                                ? "bg-primary text-white shadow-2xs font-bold"
                                : "text-panel-text hover:text-foreground hover:bg-card"
                            }`}
                            title={`${opt.id} - ${opt.sub}`}
                          >
                            <AspectRatioGraphic ratio={opt.id} className="mb-1" />
                            <span className="text-[10px] font-medium leading-none">{opt.id}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Detailed List */}
                    <div className="space-y-0.5">
                      {ASPECT_RATIO_OPTIONS.map((opt) => {
                        const isSelected = selectedAspectRatio === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              handleSelectAspectRatio(opt.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <AspectRatioGraphic ratio={opt.id} className={isSelected ? "text-primary" : "text-panel-text"} />
                              <span className="font-semibold">{opt.id}</span>
                              <span className="text-[10px] text-panel-text">({opt.sub})</span>
                            </div>
                            {isSelected && <Check size={12} className="text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Custom Backdrop Color Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "mood" ? null : "mood")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "mood" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select studio backdrop color"
                >
                  <span className="text-panel-text font-normal text-[11px]">Backdrop:</span>
                  <div 
                    className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/30 shadow-2xs shrink-0" 
                    style={{ backgroundColor: currentMood.color }} 
                  />
                  <span>{currentMood.shortLabel || currentMood.label}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "mood" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "mood" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[250px] max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Studio Backdrop Color
                    </div>
                    <div className="space-y-0.5">
                      {MOOD_OPTIONS.map((m) => {
                        const isSelected = selectedMood === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              handleSelectMood(m.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 pr-2 min-w-0">
                              <div 
                                className="w-5 h-5 rounded-full border border-black/20 dark:border-white/30 shadow-xs ring-2 ring-black/5 dark:ring-white/10 shrink-0" 
                                style={{ backgroundColor: m.color }} 
                              />
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold truncate">
                                  {m.label}
                                </div>
                                <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">
                                  {m.desc}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prompt Action Bar (Target Batches + Copy) */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-y-2 gap-x-2 shrink-0 border-t border-border/40">
            {/* Left: Compact Batch Stepper & Popover */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-[10px] font-bold text-panel-text uppercase tracking-wider shrink-0 mr-0.5">
                Target:
              </span>
              
              {batches.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* All Scenes Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedBatchIndex(-1)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      selectedBatchIndex === -1
                        ? "bg-primary text-white font-semibold shadow-2xs"
                        : "bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text border border-border/60"
                    }`}
                  >
                    All ({sentences.length})
                  </button>

                  {/* Thumbnail Option Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedBatchIndex(-2)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedBatchIndex === -2
                        ? "bg-amber-500 text-white font-semibold shadow-2xs ring-1 ring-amber-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                    }`}
                    title="Generate Frontier Prompt for YouTube Thumbnail"
                  >
                    <Sparkles size={11} className={selectedBatchIndex === -2 ? "text-white" : "text-amber-500"} />
                    <span>Thumbnail</span>
                  </button>

                  {/* Batch Dropdown */}
                  <div className="relative" ref={batchDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "batch" ? null : "batch")}
                      className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs ${
                        selectedBatchIndex >= 0 
                          ? "border-primary text-primary font-bold" 
                          : selectedBatchIndex === -2
                            ? "border-amber-500/50 text-amber-600 dark:text-amber-400 font-bold"
                            : "border-border/70 text-panel-text hover:text-foreground"
                      }`}
                      title="Select target batch"
                    >
                      <span>
                        {selectedBatchIndex === -2
                          ? "Thumbnail"
                          : selectedBatchIndex >= 0 && batches[selectedBatchIndex]
                            ? `B${selectedBatchIndex + 1} (${batches[selectedBatchIndex].start}–${batches[selectedBatchIndex].end})`
                            : `Batches (${batches.length})`}
                      </span>
                      <ChevronDown size={11} className={`transition-transform duration-150 ${openDropdown === "batch" ? "rotate-180 text-primary" : "text-panel-text"}`} />
                    </button>

                    {/* Upward Popover Grid */}
                    {openDropdown === "batch" && (
                      <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2.5 min-w-[280px] max-w-[340px] max-h-[260px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-panel-text uppercase tracking-wider px-1 pb-1.5 border-b border-border/40 mb-2">
                          <span>Select Target Batch</span>
                          <span className="text-[10px] text-panel-text font-medium">{batches.length} Batches Total</span>
                        </div>

                        {/* All Scenes Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatchIndex(-1);
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] mb-1.5 transition-colors cursor-pointer ${
                            selectedBatchIndex === -1 ? "bg-primary/10 text-primary font-bold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span>All Scenes (1–{sentences.length})</span>
                          {selectedBatchIndex === -1 && <Check size={12} className="text-primary" />}
                        </button>

                        {/* Thumbnail Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatchIndex(-2);
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] mb-1.5 transition-colors cursor-pointer ${
                            selectedBatchIndex === -2 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={12} className="text-amber-500" />
                            <span>YouTube Thumbnail Prompt</span>
                          </span>
                          {selectedBatchIndex === -2 && <Check size={12} className="text-amber-500" />}
                        </button>

                        {/* Grid of Batches */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {batches.map((batch, idx) => {
                            const isSelected = selectedBatchIndex === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedBatchIndex(idx);
                                  setOpenDropdown(null);
                                }}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-primary text-white border-primary shadow-2xs font-bold"
                                    : "bg-background/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground/90 border-border/50"
                                }`}
                              >
                                <div className="flex items-baseline gap-1.5">
                                  <span className={isSelected ? "text-white font-bold" : "text-primary font-semibold"}>B{idx + 1}</span>
                                  <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-panel-text"}`}>
                                    ({batch.start}–{batch.end})
                                  </span>
                                </div>
                                {isSelected && <Check size={12} className="text-white shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Batch Size Dropdown (Beside stepper, appears above, plenty of options!) */}
                  <div className="relative" ref={batchSizeRef}>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "batchSize" ? null : "batchSize")}
                      className={`flex items-center gap-1 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                        openDropdown === "batchSize" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                      }`}
                      title={`Choose scenes per batch (current: ${batchSize})`}
                    >
                      <span>{batchSize}/batch</span>
                      <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "batchSize" ? "rotate-180 text-primary" : ""}`} />
                    </button>

                    {openDropdown === "batchSize" && (
                      <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[150px] animate-in fade-in zoom-in-95 duration-100">
                        <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                          Scenes Per Batch
                        </div>
                        <div className="space-y-0.5">
                          {[3, 5, 8, 10, 15, 20].map((sz) => {
                            const isSelected = batchSize === sz;
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setBatchSize(sz);
                                  setSelectedBatchIndex(0);
                                  setOpenDropdown(null);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-colors cursor-pointer ${
                                  isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }`}
                              >
                                <span>{sz} scenes</span>
                                {isSelected && <Check size={12} className="text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-panel-text italic">
                  Paste script to prompt
                </span>
              )}
            </div>

            {/* Right: Action Buttons (AI Generate + Quick Split + Preview + Copy Prompt with Merged Stepper) */}
            <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
              {/* Direct AI Generate Scenes Button */}
              <button
                type="button"
                onClick={handleAutoGenerateScenes}
                disabled={sentences.length === 0 || isAutoGenerating}
                className="h-8 px-3 rounded-lg bg-gradient-to-r from-amber-500 via-primary to-primary hover:opacity-95 text-[11.5px] font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-sm"
                title="Plan short scenes with an image prompt and a motion direction"
              >
                {isAutoGenerating ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-white" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-amber-200" />
                    <span>Generate Scenes (AI)</span>
                  </>
                )}
              </button>

              {/* Quick 1:1 Split Lines Button */}
              <button
                type="button"
                onClick={handleQuickSplitScenes}
                disabled={sentences.length === 0 || isSplitting}
                className="h-8 px-2.5 rounded-lg border border-border/80 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11.5px] font-semibold text-foreground/85 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-2xs"
                title="Directly split script lines 1:1 into scenes without calling AI"
              >
                {isSplitting ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Zap size={12} className="text-amber-500" />
                )}
                <span>Quick Split</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                disabled={sentences.length === 0}
                className="h-8 px-2.5 rounded-lg border border-border/80 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11.5px] font-medium text-foreground flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-2xs"
                title="Preview prompt"
              >
                <Eye size={13} className="text-primary" />
                <span>Preview</span>
              </button>

              {/* Merged Stepper Copy Button */}
              <div className={`flex items-center rounded-lg shadow-2xs overflow-hidden border ${
                selectedBatchIndex === -2 ? "border-amber-500/50 bg-amber-600" : "border-primary/40 bg-primary"
              } h-8 transition-colors`}>
                {/* Prev Batch Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex === -2) {
                      setSelectedBatchIndex(batches.length > 0 ? batches.length - 1 : -1);
                    } else if (selectedBatchIndex > 0) {
                      setSelectedBatchIndex(selectedBatchIndex - 1);
                    } else if (selectedBatchIndex === 0) {
                      setSelectedBatchIndex(-1);
                    }
                  }}
                  disabled={selectedBatchIndex === -1 || sentences.length === 0}
                  className="h-full px-2 bg-transparent hover:bg-white/10 active:bg-black/10 text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-r border-white/20 flex items-center justify-center"
                  title={selectedBatchIndex > 0 ? `Previous batch (B${selectedBatchIndex})` : selectedBatchIndex === -2 ? "Previous batch" : "Previous (All scenes)"}
                >
                  <ChevronLeft size={13} strokeWidth={2.5} />
                </button>

                {/* Middle Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={sentences.length === 0}
                  className={`h-full px-3.5 bg-transparent hover:bg-white/10 active:bg-black/10 text-white font-semibold text-[11.5px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                    isCopied ? "bg-emerald-600 hover:bg-emerald-600" : ""
                  }`}
                  title="Copy prompt for current target"
                >
                  {isCopied ? (
                    <>
                      <Check size={13} strokeWidth={2.5} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>
                        {selectedBatchIndex === -2
                          ? "Copy Thumbnail"
                          : selectedBatchIndex === -1
                            ? `Copy All (${sentences.length})`
                            : `Copy B${selectedBatchIndex + 1}`}
                      </span>
                    </>
                  )}
                </button>

                {/* Next Batch Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex === -1) {
                      setSelectedBatchIndex(batches.length > 0 ? 0 : -2);
                    } else if (selectedBatchIndex >= 0 && selectedBatchIndex < batches.length - 1) {
                      setSelectedBatchIndex(selectedBatchIndex + 1);
                    } else if (selectedBatchIndex === batches.length - 1) {
                      setSelectedBatchIndex(-2);
                    }
                  }}
                  disabled={selectedBatchIndex === -2 || sentences.length === 0}
                  className="h-full px-2 bg-transparent hover:bg-white/10 active:bg-black/10 text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-l border-white/20 flex items-center justify-center"
                  title={selectedBatchIndex < batches.length - 1 ? `Next batch (B${selectedBatchIndex + 2})` : selectedBatchIndex >= 0 ? "Next (Thumbnail)" : "Next batch"}
                >
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {/* AI Generation Feedback Banners */}
          {autoGenError && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{autoGenError}</span>
              </div>
              <button onClick={() => setAutoGenError(null)} className="hover:opacity-75">
                <X size={12} />
              </button>
            </div>
          )}

          {autoGenSuccess && (
            <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{autoGenSuccess}</span>
              </div>
              <button onClick={() => setAutoGenSuccess(null)} className="hover:opacity-75">
                <X size={12} />
              </button>
            </div>
          )}

        </div>

        {/* ======================================================= */}
        {/* STORYBOARD DECK (RIGHT COLUMN)                          */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full overflow-hidden pl-5 border-l border-border/50">
          {/* Header Bar */}
          <div className="h-8 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-primary" />
              <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">
                Storyboard Deck
              </span>
              <span className="text-[10px] font-semibold text-panel-text bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsJsonDrawerOpen(!isJsonDrawerOpen)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                isJsonDrawerOpen
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground border border-border/50"
              }`}
            >
              <FileCode2 size={12} />
              <span>{isJsonDrawerOpen ? "Close Ingest" : "Paste JSON"}</span>
              {isJsonDrawerOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          </div>

          {/* Collapsible JSON Ingestion Drawer (Box only when open) */}
          {isJsonDrawerOpen && (
            <div className="bg-card rounded-xl p-3 my-2 border border-border/80 shadow-2xs space-y-2 animate-in fade-in duration-150 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                  Paste AI Response JSON
                </span>

                {/* Mode toggle */}
                <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-md text-[10px]">
                  <button
                    type="button"
                    onClick={() => setImportMode("replace")}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                      importMode === "replace"
                        ? "bg-card text-red-500 shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                    title="Wipe existing scenes and replace"
                  >
                    Replace All
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("append")}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                      importMode === "append"
                        ? "bg-card text-emerald-500 shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                    title="Append new scenes to end"
                  >
                    Append
                  </button>
                </div>
              </div>

              <textarea
                value={jsonInput}
                onChange={handleJsonChange}
                rows={3}
                placeholder='Paste JSON here: [ { "scene_number": 1, "narration_khmer": "...", "image_prompt_english": "...", "video_prompt": "..." } ]'
                className="w-full p-2.5 bg-background/50 dark:bg-zinc-900/40 rounded-lg border border-border/60 font-mono text-[11px] text-foreground placeholder:text-zinc-400/40 focus:border-primary focus:outline-none transition-all resize-none custom-scrollbar"
              />

              {jsonError && (
                <div className="text-[11px] text-red-500 flex items-center gap-1.5 bg-red-500/10 p-2 rounded-md">
                  <AlertCircle size={12} className="shrink-0" />
                  <span className="truncate">{jsonError}</span>
                </div>
              )}
              {importSuccessMessage && (
                <div className="text-[11px] text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 p-2 rounded-md">
                  <CheckCircle2 size={12} className="shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportScenes}
                disabled={!jsonInput.trim() || !!jsonError || isImporting}
                className="w-full py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[11px] font-semibold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Ingesting Scenes...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight size={12} />
                    <span>Ingest {importMode === "append" ? "and Append" : "and Replace"}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Storyboard Scene Cards List - Fully Displayed, NO internal scrollbars */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 my-2 pr-1">
            {scenes.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-border/70 rounded-xl text-panel-text space-y-3 bg-card/40">
                <Layers size={26} className="mx-auto opacity-35 text-primary" />
                <div className="space-y-1">
                  <p className="text-[13px] font-semibold text-foreground/90">Storyboard Deck is currently empty</p>
                  <p className="text-[11px] text-panel-text max-w-sm mx-auto leading-relaxed">
                    {scriptText.trim()
                      ? "Your script is filled! Click below to auto-generate visual prompts with AI, or split lines into scenes."
                      : "Write or paste your educational script in the editor on the left to begin."}
                  </p>
                </div>
                {scriptText.trim() && (
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAutoGenerateScenes}
                      disabled={isAutoGenerating || hasActiveVideoJobs}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-primary to-primary hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isAutoGenerating ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-white" />
                          <span>Generating Scenes...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} className="text-amber-200" />
                          <span>Generate Scenes (AI)</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickSplitScenes}
                      disabled={isSplitting}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Zap size={13} className="text-amber-500" />
                      <span>Quick Split Lines</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              scenes.map((scene: any, idx: number) => {
                const isBeingDragged = draggedSceneIdx === idx;
                const isDropTarget = dragOverSceneIdx === idx;

                return (
                  <div 
                    key={scene.id || scene.scene_number} 
                    draggable={dragHandleActiveIdx === idx}
                    onDragStart={(e) => handleSceneDragStart(e, idx)}
                    onDragOver={(e) => handleSceneDragOver(e, idx)}
                    onDrop={(e) => handleSceneDrop(e, idx)}
                    onDragEnd={handleSceneDragEnd}
                    className={`group bg-card rounded-xl p-3.5 border transition-all shadow-2xs space-y-2 relative ${
                      isBeingDragged ? "opacity-30 scale-[0.98] border-dashed border-primary" : ""
                    } ${
                      isDropTarget && dropPosition === "before" ? "border-t-2 border-t-primary" : ""
                    } ${
                      isDropTarget && dropPosition === "after" ? "border-b-2 border-b-primary" : ""
                    } ${
                      !isBeingDragged && !isDropTarget ? "border-border/70 hover:border-border" : ""
                    }`}
                  >
                    {/* Scene Header */}
                    <div className="flex items-center justify-between pb-1 border-b border-border/30">
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="cursor-grab active:cursor-grabbing text-panel-text/40 hover:text-foreground transition-colors p-0.5 select-none" 
                          title="Drag to reorder sequence"
                          onMouseEnter={() => setDragHandleActiveIdx(idx)}
                          onMouseLeave={() => {
                            if (draggedSceneIdx === null) setDragHandleActiveIdx(null);
                          }}
                          onMouseDown={() => setDragHandleActiveIdx(idx)}
                          onTouchStart={() => setDragHandleActiveIdx(idx)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical size={12} />
                        </span>
                        <span className="text-[11px] font-bold text-primary tracking-wide">
                          Scene #{String(scene.scene_number).padStart(2, "0")}
                        </span>
                      </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteScene(scene.id)}
                      className="text-panel-text/60 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded cursor-pointer"
                      title="Delete scene"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Khmer Voiceover - Fully Displayed (AutoResize) */}
                  <div className="select-text cursor-text" onMouseDown={(e) => e.stopPropagation()}>
                    <label className="text-[9px] font-semibold text-panel-text uppercase tracking-wider block mb-0.5 select-none">
                      Voiceover (Khmer)
                    </label>
                    <AutoResizeTextarea
                      defaultValue={scene.narration_khmer || ""}
                      onBlur={(val) => updateSingleScene(scene.id, { narration_khmer: val })}
                      placeholder="Khmer voiceover narration..."
                      className="w-full bg-transparent text-[13px] text-foreground leading-relaxed outline-none border-b border-border/30 focus:border-primary transition-colors py-0.5 select-text cursor-text"
                    />
                  </div>

                  {/* English Visual Prompt - Fully Displayed (AutoResize) */}
                  <div className="select-text cursor-text" onMouseDown={(e) => e.stopPropagation()}>
                    <label className="text-[9px] font-semibold text-panel-text uppercase tracking-wider block mb-0.5 select-none">
                      Image Prompt (English)
                    </label>
                    <AutoResizeTextarea
                      defaultValue={scene.image_prompt_english || ""}
                      disabled={scene.video_status === "queued" || scene.video_status === "processing"}
                      onBlur={(val) => updateSingleScene(scene.id, { image_prompt_english: val })}
                      placeholder="Describe the starting image for this scene…"
                      className="w-full bg-transparent font-mono text-[11px] text-foreground/80 leading-relaxed outline-none border-b border-border/30 focus:border-primary transition-colors py-0.5 select-text cursor-text"
                    />
                  </div>

                  {!scene.image_prompt_english && <button type="button" disabled={planningImageId !== null} onClick={() => handlePlanImage(scene.id)} className="text-xs text-primary hover:underline disabled:opacity-50">{planningImageId === scene.id ? "Planning image…" : "Plan image from narration"}</button>}
                  <div className="select-text cursor-text" onMouseDown={(event) => event.stopPropagation()}>
                    <label className="text-[9px] font-semibold text-panel-text uppercase tracking-wider block mb-0.5">Motion direction for Assembly</label>
                    <AutoResizeTextarea defaultValue={scene.video_prompt || ""} disabled={scene.video_status === "queued" || scene.video_status === "processing"} onBlur={(value) => updateSingleScene(scene.id, { video_prompt: value })} placeholder="Character movement and camera direction; timing comes from the voiceover." className="w-full bg-transparent text-[11px] text-foreground/80 outline-none border-b border-border/30 focus:border-primary py-0.5" />
                  </div>

                  {/* Negative Constraints: Click-to-expand dropdown */}
                  <div className="pt-1 border-t border-border/30">
                    <button
                      type="button"
                      onClick={() => toggleExclusion(scene.id)}
                      className="flex items-center gap-1.5 text-[10px] font-medium text-panel-text hover:text-foreground cursor-pointer transition-colors py-0.5 w-full text-left"
                      title="Click to expand/collapse exclusions"
                    >
                      <ChevronRight 
                        size={11} 
                        className={`text-panel-text transition-transform duration-150 shrink-0 ${
                          expandedExclusions[scene.id] ? "rotate-90 text-primary" : ""
                        }`} 
                      />
                      <span className="uppercase tracking-wider text-[9px] font-semibold text-panel-text">
                        Exclusions
                      </span>
                      {!expandedExclusions[scene.id] && scene.negative_prompt && (
                        <span className="text-[10px] font-mono text-panel-text/60 truncate flex-1 ml-1">
                          — {scene.negative_prompt}
                        </span>
                      )}
                      {!expandedExclusions[scene.id] && !scene.negative_prompt && (
                        <span className="text-[10px] text-panel-text/40 italic flex-1 ml-1">
                          (none)
                        </span>
                      )}
                    </button>

                    {expandedExclusions[scene.id] && (
                      <div className="pt-1.5 pb-0.5 animate-in fade-in duration-100">
                        <AutoResizeTextarea
                          defaultValue={scene.negative_prompt || ""}
                          onBlur={(val) => updateSingleScene(scene.id, { negative_prompt: val })}
                          placeholder="e.g. text, words, labels, comic book, 3D, photorealistic..."
                          className="w-full bg-zinc-100/60 dark:bg-zinc-900/60 p-2 rounded-lg font-mono text-[10px] text-foreground leading-relaxed outline-none border border-border/60 focus:border-primary transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>

        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL: PROMPT PREVIEW WITH BATCH SWITCHER                */}
      {/* ========================================================= */}
      {isPreviewOpen && (
        <div 
          onClick={() => setIsPreviewOpen(false)}
          className="fixed inset-0 z-50 bg-black/35 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            
            {/* Modal Header */}
            <div className="h-12 px-5 border-b border-border flex items-center justify-between shrink-0 bg-card">
              <div className="flex items-center gap-2">
                <Eye size={15} className={selectedBatchIndex === -2 ? "text-amber-500" : "text-primary"} />
                <div>
                  <h3 className="text-[13px] font-bold text-foreground">
                    {selectedBatchIndex === -2 ? "Thumbnail Frontier Prompt Preview" : "Image Storyboard Prompt Preview"}
                  </h3>
                  <p className="text-[10px] text-panel-text">
                    {selectedBatchIndex === -2 
                      ? "Complete video context & style directives formatted for YouTube Thumbnail generation in ChatGPT / Claude / Gemini" 
                      : "Exact text formatted for ChatGPT / Claude web chat"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-panel-text hover:text-foreground p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Batch Switcher inside Modal - Wrapping without horizontal scroll */}
            <div className="px-5 py-2.5 bg-background/60 border-b border-border flex items-center gap-1.5 flex-wrap shrink-0">
              <span className="text-[10px] font-bold text-panel-text uppercase tracking-wider mr-1">
                Target:
              </span>
              <button
                type="button"
                onClick={() => setSelectedBatchIndex(-1)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  selectedBatchIndex === -1
                    ? "bg-primary text-white font-semibold shadow-2xs"
                    : "bg-card border border-border text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                All ({sentences.length})
              </button>
              {batches.map((b, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedBatchIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    selectedBatchIndex === idx
                      ? "bg-primary text-white font-semibold shadow-2xs"
                      : "bg-card border border-border text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  B{idx + 1} ({b.start}–{b.end})
                </button>
              ))}

              {/* Thumbnail Frontier Tab Button */}
              <div className="h-4 w-px bg-border/80 mx-1" />
              <button
                type="button"
                onClick={() => setSelectedBatchIndex(-2)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedBatchIndex === -2
                    ? "bg-amber-500 text-white font-semibold shadow-2xs ring-1 ring-amber-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                }`}
                title="YouTube Thumbnail Prompt for Web LLM"
              >
                <Sparkles size={11} className={selectedBatchIndex === -2 ? "text-white" : "text-amber-500"} />
                <span>Thumbnail</span>
              </button>
            </div>

            {/* Prompt Text Body */}
            <div className="flex-1 overflow-y-auto p-5 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-mono text-[12px] leading-relaxed custom-scrollbar whitespace-pre-wrap select-text border-y border-border/80">
              {generatePrompt()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-card border-t border-border flex items-center justify-end shrink-0">

              {/* Stepper Copy Button inside Modal */}
              <div className={`flex items-center rounded-lg shadow-2xs overflow-hidden border ${
                selectedBatchIndex === -2 ? "border-amber-500/50 bg-amber-600" : "border-primary/40 bg-primary"
              } h-8 transition-colors`}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex === -2) {
                      setSelectedBatchIndex(batches.length > 0 ? batches.length - 1 : -1);
                    } else if (selectedBatchIndex > 0) {
                      setSelectedBatchIndex(selectedBatchIndex - 1);
                    } else if (selectedBatchIndex === 0) {
                      setSelectedBatchIndex(-1);
                    }
                  }}
                  disabled={selectedBatchIndex === -1}
                  className="h-full px-2.5 bg-transparent hover:bg-white/10 active:bg-black/10 text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-r border-white/20 flex items-center justify-center"
                  title={selectedBatchIndex > 0 ? `Previous batch (B${selectedBatchIndex})` : selectedBatchIndex === -2 ? "Previous batch" : "Previous (All scenes)"}
                >
                  <ChevronLeft size={13} strokeWidth={2.5} />
                </button>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`h-full px-4 bg-transparent hover:bg-white/10 active:bg-black/10 text-white font-semibold text-[11.5px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isCopied ? "bg-emerald-600 hover:bg-emerald-600" : ""
                  }`}
                  title="Copy prompt for current target"
                >
                  {isCopied ? (
                    <>
                      <Check size={13} strokeWidth={2.5} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>
                        {selectedBatchIndex === -2
                          ? "Copy Thumbnail Prompt"
                          : selectedBatchIndex === -1
                            ? `Copy All (${sentences.length})`
                            : `Copy B${selectedBatchIndex + 1}`}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex === -1) {
                      setSelectedBatchIndex(batches.length > 0 ? 0 : -2);
                    } else if (selectedBatchIndex >= 0 && selectedBatchIndex < batches.length - 1) {
                      setSelectedBatchIndex(selectedBatchIndex + 1);
                    } else if (selectedBatchIndex === batches.length - 1) {
                      setSelectedBatchIndex(-2);
                    }
                  }}
                  disabled={selectedBatchIndex === -2}
                  className="h-full px-2.5 bg-transparent hover:bg-white/10 active:bg-black/10 text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-l border-white/20 flex items-center justify-center"
                  title={selectedBatchIndex < batches.length - 1 ? `Next batch (B${selectedBatchIndex + 2})` : selectedBatchIndex >= 0 ? "Next (Thumbnail)" : "Next batch"}
                >
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
