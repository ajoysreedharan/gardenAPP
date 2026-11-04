import { render } from 'preact';
import { App } from './ui/App';
import { requestPersistence } from './db/db';

// Ask Chrome not to evict garden data when storage runs low.
requestPersistence();
render(<App />, document.getElementById('app')!);
