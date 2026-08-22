// Vue binding for the command bus (utils/app-commands.js): register a command
// owner for the life of the current component / effect scope. Registration
// happens at setup time so the command is dispatchable as soon as the owner
// exists; the scope's disposal unregisters it.

import { getCurrentScope, onScopeDispose } from 'vue';
import { registerAppCommand } from '../utils/app-commands.js';

export const useAppCommand = (name, handler) => {
    const unregister = registerAppCommand(name, handler);
    if (getCurrentScope()) onScopeDispose(unregister);
    return unregister;
};
