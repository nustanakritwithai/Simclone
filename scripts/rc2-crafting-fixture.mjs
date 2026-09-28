import {serialize} from '../src/engine.mjs';
import {rc2World} from '../tests/fixtures/rc2-world.mjs';
process.stdout.write(serialize(rc2World()));
