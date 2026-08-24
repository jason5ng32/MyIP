// The DNS record types /api/dnsresolver answers for — one list behind three
// consumers: the record-type <Select> in DnsResolver.vue, the requireValidRecordType
// guard, and the switch in api/dns-resolver.js that maps each type onto a
// resolver method. Array order is the order the picker renders.
export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA'];

export const DNS_RECORD_TYPE_SET = new Set(DNS_RECORD_TYPES);

// Types whose answers are domain names. Presentation form carries the root
// dot; Node's resolver drops it and a DoH endpoint may too, so both transports
// normalize through it — otherwise one provider's two rows differ on
// punctuation alone and read as a real disagreement.
export const NAME_VALUED_TYPES = new Set(['CNAME', 'NS']);
