// src/pages/api/v2/clients/programs/save.js
// POST — insert or update a client_programs record.
// Body: { _id?, client_id, program_type, scholar_name, birthdate, sex,
//         year_level, school_name, course, grant_date, picture_key? }
//
// Business rule: only group leaders may have programs.
// When a client loses group-leader status the record is NOT deleted —
// status is set to 'inactive' (Option A). New records are blocked if
// client.groupLeader === false.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl, queryQl } from '@/lib/graph/graph.util';
import { CLIENT_PROGRAM_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';

const graph = new GraphProvider();

const PROGRAM_TYPE = createGraphType('client_programs', CLIENT_PROGRAM_FIELDS)('client_programs');

// Minimal client fetch — only need groupLeader flag
const CLIENT_GL_TYPE = createGraphType('client', '_id groupLeader')('clients');

export default apiHandler({ post: save });

async function save(req, res) {
    const userId = req.auth.sub;
    const {
        _id,
        client_id,
        program_type = 'scholarship',
        scholar_name,
        birthdate,
        sex,
        year_level,
        school_name,
        course,
        grant_date,
        picture_key,
    } = req.body;

    // ── Validate required fields ───────────────────────────────────────────
    const missing = ['client_id', 'scholar_name', 'birthdate', 'sex',
        'year_level', 'school_name', 'course', 'grant_date']
        .filter(f => !req.body[f]);
    if (missing.length) {
        return res.status(200).json({
            success: false,
            message: `Missing required fields: ${missing.join(', ')}`,
        });
    }

    // ── For new records: verify client is a group leader ──────────────────
    if (!_id) {
        const [client] = await graph.query(
            queryQl(CLIENT_GL_TYPE, { where: { _id: { _eq: client_id } } })
        ).then(r => r.data?.clients ?? []);

        if (!client) {
            return res.status(200).json({ success: false, message: 'Client not found.' });
        }
        if (!client.groupLeader) {
            return res.status(200).json({
                success: false,
                message: 'Only group leaders can avail of company programs.',
            });
        }
    }

    const now = new Date().toISOString();

    // ── UPDATE ─────────────────────────────────────────────────────────────
    if (_id) {
        const result = await graph.mutation(
            updateQl(PROGRAM_TYPE, {
                set: {
                    scholar_name,
                    birthdate,
                    sex,
                    year_level,
                    school_name,
                    course,
                    grant_date,
                    picture_key: picture_key ?? undefined,
                    modified_by: userId,
                    modified_date: now,
                },
                where: { _id: { _eq: _id } },
            })
        );

        if (result.errors?.length) {
            return res.status(200).json({ success: false, message: result.errors[0].message });
        }

        const updated = result.data?.client_programs?.returning?.[0];
        return res.status(200).json({ success: true, program: updated });
    }

    // ── INSERT ─────────────────────────────────────────────────────────────
    const newId = generateUUID();
    const result = await graph.mutation(
        insertQl(PROGRAM_TYPE, {
            objects: [{
                _id: newId,
                client_id,
                program_type,
                scholar_name,
                birthdate,
                sex,
                year_level,
                school_name,
                course,
                grant_date,
                picture_key: picture_key ?? null,
                status: 'active',
                inserted_by: userId,
                inserted_date: now,
            }],
        })
    );

    if (result.errors?.length) {
        return res.status(200).json({ success: false, message: result.errors[0].message });
    }

    const created = result.data?.client_programs?.returning?.[0];
    return res.status(200).json({ success: true, program: created });
}