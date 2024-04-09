// api/dnsresolver.js
import { Resolver } from 'dns';
import { promisify } from 'util';

// 普通 DNS 服务器列表
const dnsServers = {
    'Google': '8.8.8.8',
    'Cloudflare': '1.1.1.1',
    'OpenDNS': '208.67.222.222',
    'Quad9': '9.9.9.9',
    'ControlD': '76.76.2.0',
    'AdGuard': '94.140.14.14',
    'Quad 101': '101.101.101.101',
    'AliDNS': '223.5.5.5',
    'DNSPod': '119.29.29.29',
    '114DNS': '114.114.114.114',
    'China Unicom': '123.123.123.123',
};

// DNS-over-HTTPS 服务列表
const dohServers = {
    'Google': 'https://dns.google/resolve?',
    'Cloudflare': 'https://cloudflare-dns.com/dns-query?ct=application/dns-json&',
    'AliDNS': 'https://dns.alidns.com/resolve?',
};

const resolveDns = async (hostname, name, server) => {
    const resolver = new Resolver();
    resolver.setServers([server]);
    const resolve4Async = promisify(resolver.resolve4.bind(resolver));
    try {
        const addresses = await resolve4Async(hostname);
        return { [name]: addresses };
    } catch (error) {
        console.log(error.message);
        return { [name]: `Error: No addresses found` };
    }
};

const resolveDoh = async (hostname, name, url) => {
    try {
        const response = await fetch(`${url}name=${hostname}&type=A`, {
            headers: { 'Accept': 'application/dns-json' }
        });
        const data = await response.json();
        const addresses = data.Answer ? data.Answer.map(answer => answer.data) : ['Error: No addresses found'];
        return { [name]: addresses };
    } catch (error) {
        console.log(error.message);
        return { [name]: `Error: No addresses found` };
    }
};

const dnsResolver = async (req, res) => {

    // 限制请求方法
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 限制只能从指定域名访问
    const allowedDomains = ['localhost', ...(process.env.ALLOWED_DOMAINS || '').split(',')];
    const referer = req.headers.referer;
    if (referer) {
        const domain = new URL(referer).hostname;
        if (!allowedDomains.includes(domain)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    } else {
        return res.status(403).json({ error: 'What are you doing?' });
    }

    const { hostname } = req.query;

    if (!hostname) {
        return res.status(400).send({ error: 'Missing hostname parameter' });
    }

    if (!hostname.includes('.')) {
        return res.status(400).send({ error: 'Invalid hostname' });
    }

    const dnsPromises = Object.entries(dnsServers).map(([name, ip]) => resolveDns(hostname, name, ip));
    const dohPromises = Object.entries(dohServers).map(([name, url]) => resolveDoh(hostname, name, url));

    try {
        // 并行执行所有 DNS 和 DoH 查询

        const result_dns = await Promise.all(dnsPromises);
        const result_doh = await Promise.all(dohPromises);

        res.json({
            hostname,
            result_dns,
            result_doh
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

export default dnsResolver;
