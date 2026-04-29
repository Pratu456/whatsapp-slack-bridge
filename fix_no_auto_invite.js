const fs = require('fs');
let s = fs.readFileSync('src/services/tenantService.js', 'utf8');

// Remove the fallback that invites all members when no agents configured
const oldFallback = `      } else {
          // No agents configured — invite all workspace members (fallback)
          console.log('[CHANNEL] No agents configured, inviting all members');
          const memberList = await slack.users.list();
          const humanIds = memberList.members
            .filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
            .map(m => m.id);
          for (let i = 0; i < humanIds.length; i += 30) {
            const batch = humanIds.slice(i, i + 30);
            try {
              await slack.conversations.invite({ channel: channelId, users: batch.join(',') });
            } catch (err) {
              if (err.data?.error !== 'already_in_channel') {
                console.warn('Could not invite batch:', err.data?.error);
              }
            }
          }
        }`;

const newFallback = `      } else {
          // No agents configured — bot only, team joins manually
          console.log('[CHANNEL] No agents configured — channel created, team can join manually');
        }`;

s = s.replace(oldFallback, newFallback);

// Also remove ensureChannelMembers fallback that re-invites all
const oldEnsure = `    } else {
      // No assigned agent — ensure all members (legacy fallback)
      const channelInfo = await slack.conversations.members({ channel: channelId });
      const currentMembers = new Set(channelInfo.members);
      const memberList = await slack.users.list();
      const humanIds = memberList.members
        .filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
        .map(m => m.id);
      const missing = humanIds.filter(id => !currentMembers.has(id));
      if (missing.length === 0) return;
      for (let i = 0; i < missing.length; i += 30) {
        const batch = missing.slice(i, i + 30);
        try {
          await slack.conversations.invite({ channel: channelId, users: batch.join(',') });
        } catch (err) {
          if (err.data?.error !== 'already_in_channel') {
            console.warn('[CHANNEL] Re-invite error:', err.data?.error);
          }
        }
      }
    }`;

const newEnsure = `    } else {
      // No assigned agent — do nothing, team joins manually
      console.log('[CHANNEL] No assigned agent, skipping auto-invite');
    }`;

s = s.replace(oldEnsure, newEnsure);

fs.writeFileSync('src/services/tenantService.js', s);
console.log('done');
console.log('has old fallback:', s.includes('inviting all members'));
