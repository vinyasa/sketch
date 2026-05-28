import { createAssemblySlice } from './slices/assemblySlice';
import { createBoardSlice } from './slices/boardSlice';
import { createConstraintSlice } from './slices/constraintSlice';
import { createIoSlice } from './slices/ioSlice';
import { createLibrarySlice } from './slices/librarySlice';
import { createOperationSlice } from './slices/operationSlice';
import { createRecorderSlice } from './slices/recorderSlice';

export const createActions = (set, get) => ({
    ...createAssemblySlice(set, get),
    ...createBoardSlice(set, get),
    ...createConstraintSlice(set, get),
    ...createIoSlice(set, get),
    ...createLibrarySlice(set, get),
    ...createOperationSlice(set, get),
    ...createRecorderSlice(set, get),
});
