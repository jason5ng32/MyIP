// api/dnsresolver.js
import { Resolver } from 'dns';
import { promisify } from 'util';
import { refererCheck } from '../common/referer-check.js';

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
    'AdGuard': 'https://dns.adguard.com/resolve?',
    'AliDNS': 'https://dns.alidns.com/resolve?',
};

const resolveDns = async (hostname, type, name, server) => {
    const resolver = new Resolver();
    resolver.setServers([server]);
    const resolve4Async = promisify(resolver.resolve4.bind(resolver));
    const resolve6Async = promisify(resolver.resolve6.bind(resolver));
    const resolveTxtAsync = promisify(resolver.resolveTxt.bind(resolver));
    const resolveCnameAsync = promisify(resolver.resolveCname.bind(resolver));
    const resolveNSAsync = promisify(resolver.resolveNs.bind(resolver));
    const resolveMXAsync = promisify(resolver.resolveMx.bind(resolver));
    try {
        let addresses;

        // 根据传入的 type 参数选择不同的解析方法
        switch (type) {
            case 'A':
                addresses = await resolve4Async(hostname);
                break;
            case 'AAAA':
                addresses = await resolve6Async(hostname);
                break;
            case 'TXT':
                addresses = await resolveTxtAsync(hostname);
                // TXT 记录解析的结果是一个二维数组，这里进行扁平化处理
                addresses = addresses.flat();
                break;
            case 'CNAME':
                addresses = await resolveCnameAsync(hostname);
                break;
            case 'NS':
                addresses = await resolveNSAsync(hostname);
                break;
            case 'MX':
                addresses = await resolveMXAsync(hostname);
                addresses = addresses.map(item => `${item.priority} ${item.exchange}.`)
                .join(', ');
                break;
            default:
                throw new Error('Unsupported type');
        }

        if (addresses.length === 0 || addresses === '' || addresses === null) {
            return { [name]: `N/A` };
        }

        return { [name]: addresses };
    } catch (error) {
        console.log(error.message);
        return { [name]: `N/A` };
    }
};

const resolveDoh = async (hostname, type, name, url) => {
    try {
        const response = await fetch(`${url}name=${hostname}&type=${type}`, {
            headers: { 'Accept': 'application/dns-json' }
        });
        const data = await response.json();
        const addresses = data.Answer ? data.Answer.map(answer => answer.data) : ['N/A'];
        if (addresses.length === 0 || addresses === '' || addresses === null) {
            return { [name]: `N/A` };
        }
        return { [name]: addresses };
    } catch (error) {
        console.log(error.message);
        return { [name]: `N/A` };
    }
};

const dnsResolver = async (req, res) => {

    // 限制请求方法
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    const { hostname, type } = req.query;

    if (typeof hostname !== 'string') {
        return res.status(400).send({ error: 'Hostname parameter must be a string' });
    }

    if (!hostname) {
        return res.status(400).send({ error: 'Missing hostname parameter' });
    }

    if (!hostname.includes('.')) {
        return res.status(400).send({ error: 'Invalid hostname' });
    }

    const dnsPromises = Object.entries(dnsServers).map(([name, ip]) => resolveDns(hostname, type, name, ip));
    const dohPromises = Object.entries(dohServers).map(([name, url]) => resolveDoh(hostname, type, name, url));

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
