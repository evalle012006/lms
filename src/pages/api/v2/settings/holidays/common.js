import { createGraphType } from '@/lib/graph/graph.util';
import { HOLIDAY_FIELDS } from '@/lib/graph.fields';

export const holidayType = createGraphType('holidays', HOLIDAY_FIELDS)();