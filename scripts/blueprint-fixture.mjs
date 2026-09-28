import {serialize} from '../src/engine.mjs';
import {blueprintWorld} from '../tests/fixtures/blueprint-world.mjs';
process.stdout.write(serialize(blueprintWorld(3)));
