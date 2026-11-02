import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDatabase, closeDatabase, DB_TYPE } from '../db/database.js';
import logger from '../db/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ICONS8_BASE = 'https://img.icons8.com/color/64';

const CUSTOM_IMAGES = {
  'PlayStation 3': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAACfUlEQVR4nO2ZO4saURTHbdOlzqMLyVewm7nHVyEiMoXglNlP4AO0sNCgIhaihZVFfKCoRBcFdcPVNrD5BCHZ1Nlq0yTVsifcRUcnBuFeV+cumQN/hJkz+P/dc67jmXE47LDDDjukDa/X+xIA0EopivJCGEBVVc1qAFVVNWEAAMhaDUAIyRwCcC4BwEgYgBDyXQKAKyHzTqfzCQDcWQ0AAHfMi8jqv5HAPDK5XK7X3AAA4JEIwC0CcGa1cdjorQjAOwmM40pZEYCGBMaRiRDynhuAEPLRauOw0YVIBT5LVIFLEYBvvF+USqVwsViYNBwOMRKJGDl+vx+bzSZSSo0cdpzlbV83nU4xFoutr/vKDUAIueYFCAQCqOu6SeVyGavVqpGTSCSw3W6bcgAAw+Gw6Vg8HsfxeLyuwLUIwE9eAE3TsFAoYKlUMjQYDDCbzRo56XQaK5XKzrWNRgN7vZ4hVhH2uTp/ww0AAL95AbrdLtbrdRMAM+zz+bgBRqORAUAI+SVSgVteANbXoVBo5/h2e9RqNSwWi3tzdF3HaDSKk8lkDXB7EgC2+f4F0O/3jc3JVpW12t85wz2bWAhApIWOJSLYQtyb+Ii6OcnP6BEr8IMbgN08JAL4IlKBS6uNw0afRCpwIVEFpo/67zQANP7LgeZMAuN4yEgpzVCvqqrrUT9WURTl1UkfbHk8Hkwmk/eDy3w+3xlyeEQpZTPFU26AVRWueM0Hg0HsdDoHmV6YAfinsS2AEe/K7zOfy+XuxXOOUvrhEIAMDwBrm32ryQzm83nec5mTveBotVoP1jqLlZbLpfgLDrfb/YwHYDabPTgApfS5MIAddthhh+PY8Qf45bOE9RTt2gAAAABJRU5ErkJggg==',
  'PlayStation 4': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA1klEQVR4nO3YvwqCQADH8XuIoKGpIRuaNOLOyUW7LYf+kNGWNPYAPUaP0dRrRQ9xcYIR4aBCZ8H3Cz/QRe4DNykEEdFPluxyY+cFqpjUabHy3fUEAA3AAGgSgACAAZAAUAC8tgDb6nR+fcA+2/mDi/OJtv01IPm4QuV7eZVcTwDYATAAmgRAAzAAEgApAAkgAGAAaAAKgHQJiLf5pjzw+6LlvrO/EuNpuK51+Cg79uLscK8CzOaLzgAjXz2GUvbrXJ1r1eHtJmHUGcCziEDdGl0lIiLx7Z4hxMOTiF3J9AAAAABJRU5ErkJggg==',
  'PlayStation 5': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAACIElEQVR4nO2XMU8UQRTHNxgjVig3cwWBWEihfALiJ7Ax2hDoDth5SyWJthRWNrYUxsQPYA4tbCCEwHtLgIoAwS+gMUBCQgHBRAnhzCy76yUg3N7OnhD/v2Say+a9//zfzHtzngcAAAAAAAAAAAAAAAAAgP8GTVLLv3hLE78rjS51NZLz7nDYo4x81MQHDcUPZMCtXqlpI1W3AaOgvK197r1s85p4L1PcQg0wUs2zFPEnRfI1CaxIli4y4LTy6bfrjeQoG+4/x4DvuXQbeem5ovf59C1tRBJxpYAf/O3b5NgrIxveq1pb1lxnKnhVUCb0UwN8eVLUBq6wATL553iGj4o2QJFMeS7pqPAdHfBj23CyLEU8FG/+OGmEXrB6szADDH+Lr9CODsJKFq1ls/C0c2yx72xQn0e04X0H4/CkvmMXYYAieZNXpzK8nE4rbatuhbsYgZds3oUB3S9WbmviDy70luy7RROvxT8eK5KJrFcgWvbOX3DsXRqQxgnm75cDfpZJp+Hh+mmlSN7aO3UU36mZPIKuSxe/V+H2pI9o4q2WC/rXBliU4dm46D9bKqjTl4d1DfN90fnO1TC22KcM/4ib4aYTA+yzsrEnM++m988PB5vJle/pztOK5DDVEMi4EwOi4JnGkMx5A9UbTeXKParTKfA50tBKA07/NPFr24iazpXvnfJLkXyJKt9kAQAAAAAAAAAAAAAAAAAA4F1bfgOUn+YUzm7FyAAAAABJRU5ErkJggg==',
  'Nintendo Wii': '<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48"><rect width="10" height="34" x="6" y="3" fill="#e0e0e0"></rect><polygon fill="#bdbdbd" points="38,37 16,37 16,3 38,6"></polygon><rect width="14" height="8" x="4" y="37" fill="#757575"></rect><rect width="22" height="8" x="18" y="37" fill="#424242"></rect><rect width="11" height="34" x="32" y="11" fill="#e0e0e0"></rect><path fill="#455a64" d="M12.5,34L12.5,34c-0.828,0-1.5-0.672-1.5-1.5v-24C11,7.672,11.672,7,12.5,7h0	C13.328,7,14,7.672,14,8.5v24C14,33.328,13.328,34,12.5,34z"></path><polygon fill="#757575" points="41,15 39,15 39,13 36,13 36,15 34,15 34,18 36,18 36,20 39,20 39,18 41,18"></polygon><circle cx="37.5" cy="23.5" r="1.5" fill="#757575"></circle><circle cx="37.5" cy="35.5" r="1.5" fill="#757575"></circle><circle cx="37.5" cy="40.5" r="1.5" fill="#757575"></circle><rect width="3" height="3" x="6" y="7" fill="#b0bec5"></rect><rect width="3" height="3" x="6" y="12" fill="#b0bec5"></rect><rect width="3" height="3" x="6" y="31" fill="#b0bec5"></rect></svg>',
  'Family Game': '<svg version="1.1" id="_x36_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><g><g><rect x="25.613" y="14.338" style="fill:#F6F5F5;" width="450.316" height="497.662"/><rect x="25.613" y="0.014" style="fill:#FFF8F0;" width="450.316" height="430.489"/><rect x="55.875" y="465.768" style="fill:#974532;" width="389.792" height="28.629"/><rect x="55.875" y="481.184" style="fill:#EFE5C2;" width="389.792" height="5.506"/><rect x="71.291" y="102.403" style="fill:#F6F5F5;" width="358.961" height="146.447"/><rect x="115.86" y="0.014" style="fill:#F6F5F5;" width="269.823" height="71.548"/><rect x="196.817" y="259.311" style="fill:#F6F5F5;" width="107.908" height="146.447"/><rect x="246.074" y="259.311" style="fill:#B4AD9A;" width="9.394" height="81.207"/><g><rect x="63.032" y="332.534" style="fill:#F6F5F5;" width="107.909" height="73.224"/><rect x="330.602" y="332.534" style="fill:#F6F5F5;" width="107.909" height="73.224"/></g><rect x="71.291" y="118.92" style="fill:#974532;" width="358.961" height="101.852"/><g><rect x="196.817" y="334.324" style="fill:#7F3A26;" width="107.908" height="50.789"/><rect x="196.817" y="321.936" style="fill:#974532;" width="107.908" height="50.789"/><rect x="196.817" y="337.627" style="fill:#AD574A;" width="107.908" height="5.368"/></g><rect x="71.291" y="109.01" style="fill:#AD574A;" width="358.961" height="19.269"/><g><g><path style="fill:#974532;" d="M45.159,93.295v241.74c0,5.433-1.976,10.372-5.433,14.112c-2.752,3.105-6.351,5.362-10.513,6.421c-1.129,0.282-2.399,0.494-3.599,0.565c-0.565,0.071-1.059,0.071-1.623,0.071h-2.823C9.455,356.203,0,346.748,0,335.035V93.295c0-11.713,9.455-21.168,21.168-21.168h2.823c0.564,0,1.058,0,1.623,0.071c1.199,0.07,2.469,0.282,3.599,0.564c4.163,1.059,7.761,3.316,10.513,6.421C43.183,82.923,45.159,87.862,45.159,93.295z"/><path style="fill:#AD574A;" d="M25.287,349.447V78.883c0-3.734,3.027-6.761,6.761-6.761h0.894c3.734,0,6.761,3.027,6.761,6.761v270.564c0,3.734-3.027,6.761-6.761,6.761h-0.894C28.314,356.208,25.287,353.181,25.287,349.447z"/></g><g><path style="fill:#974532;" d="M501.546,335.032V93.299c0-11.696-9.481-21.177-21.177-21.177h-2.8c-11.695,0-21.177,9.481-21.177,21.177v241.733c0,11.696,9.481,21.177,21.177,21.177h2.8C492.064,356.208,501.546,346.727,501.546,335.032z"/><path style="fill:#AD574A;" d="M476.255,349.447V78.883c0-3.734-3.027-6.761-6.761-6.761H468.6c-3.734,0-6.761,3.027-6.761,6.761v270.564c0,3.734,3.027,6.761,6.761,6.761h0.894C473.228,356.208,476.255,353.181,476.255,349.447z"/></g></g><g><rect x="340.099" y="344.647" style="fill:#974532;" width="52.027" height="52.027"/><g><rect x="109.417" y="344.647" style="fill:#7F3A26;" width="52.027" height="52.027"/><rect x="109.417" y="358.135" style="opacity:0.5;fill:#974532;" width="52.027" height="23.949"/><rect x="109.417" y="364.742" style="fill:#7F3A26;" width="52.027" height="5.643"/></g></g><g><rect x="133.09" style="fill:#828282;" width="14.039" height="44.829"/><rect x="169.988" style="fill:#828282;" width="14.039" height="44.829"/><rect x="206.883" y="0.014" style="fill:#828282;" width="14.042" height="44.806"/><rect x="243.786" y="0.014" style="fill:#828282;" width="13.971" height="44.806"/><rect x="280.619" y="0.014" style="fill:#828282;" width="14.041" height="44.806"/><rect x="317.522" y="0.014" style="fill:#828282;" width="14.041" height="44.806"/><rect x="354.424" y="0.014" style="fill:#828282;" width="14.041" height="44.806"/></g></g><path style="opacity:0.04;fill:#040000;" d="M501.543,93.295v241.74c0,11.713-9.455,21.168-21.168,21.168h-2.823c-0.282,0-0.565-0.071-0.776-0.071c-0.283,0-0.565-0.071-0.847-0.071V512H25.613v-30.835L475.929,30.849v41.419c0.282,0,0.564-0.07,0.847-0.07c0.211,0,0.494-0.071,0.776-0.071h2.823C492.088,72.127,501.543,81.582,501.543,93.295z"/></g></svg>'
};

const ICONS8_MAP = {
  'Super Nintendo': 'super-nintendo-entertainment-system',
  'Nintendo 64': 'nintendo-64',
  'Dreamcast': 'dreamcast',
  'PlayStation 1': 'play-station',
  'PlayStation 2': 'ps2',
  'GameCube': 'nintendo-gamecube',
  'PlayStation Portable (PSP)': 'playstation-portable',
  'Nintendo DS': 'nintendo-ds',
  'Nintendo Switch': 'nintendo-switch',
  'PC': 'computer'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadAsBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'GamesTracker/1.0 (console-image-seeder)' }
    });

    if (!response || !response.ok) {
      logger.warn({ imageUrl, status: response?.status }, 'Error downloading image');
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    logger.error({ err: error, imageUrl }, 'Error downloading image');
    return null;
  }
}

async function seedConsoleImages() {
  logger.info('Starting console image seeding...');

  await initializeDatabase();
  const db = getDatabase();

  const result = await db.query('SELECT id, name, image FROM consoles ORDER BY id');
  const consoles = result.rows;

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const console of consoles) {
    const customImage = CUSTOM_IMAGES[console.name];
    if (customImage) {
      if (console.image && console.image === customImage) {
        logger.info({ console: console.name }, 'Already has correct custom image, skipping');
        skipped++;
        continue;
      }

      const isSvg = customImage.trim().startsWith('<svg');
      const imageType = isSvg ? 'svg' : 'bitmap';

      const updateSQL = DB_TYPE === 'sqlite'
        ? 'UPDATE consoles SET image = ?, image_type = ? WHERE id = ?'
        : 'UPDATE consoles SET image = $1, image_type = $2 WHERE id = $3';
      await db.query(updateSQL, [customImage, imageType, console.id]);

      logger.info({ console: console.name, imageType }, 'Custom image saved');
      seeded++;
      continue;
    }

    if (console.image && (console.image.startsWith('data:image/png') || console.image.startsWith('<svg'))) {
      logger.info({ console: console.name }, 'Already has image, skipping');
      skipped++;
      continue;
    }

    const iconName = ICONS8_MAP[console.name];
    if (!iconName) {
      logger.warn({ console: console.name }, 'No image configured');
      failed++;
      continue;
    }

    const imageUrl = `${ICONS8_BASE}/${iconName}.png`;
    logger.info({ console: console.name, imageUrl }, 'Downloading Icons8 image...');

    const base64 = await downloadAsBase64(imageUrl);
    if (!base64) {
      logger.warn({ console: console.name }, 'Could not download image');
      failed++;
      continue;
    }

    const updateSQL = DB_TYPE === 'sqlite'
      ? 'UPDATE consoles SET image = ?, image_type = ? WHERE id = ?'
      : 'UPDATE consoles SET image = $1, image_type = $2 WHERE id = $3';
    await db.query(updateSQL, [base64, 'bitmap', console.id]);

    logger.info({ console: console.name }, 'Icons8 image saved');
    seeded++;

    await sleep(500);
  }

  logger.info({ seeded, skipped, failed, total: consoles.length }, 'Console image seeding complete');
  await closeDatabase();
}

seedConsoleImages().catch((err) => {
  logger.error({ err }, 'Seed aborted');
  process.exit(1);
});
