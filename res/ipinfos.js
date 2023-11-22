var ips = []; // 创建一个空数组用于存储 IP 地址 
var alertDisplayed = false;  // 添加一个新的全局变量


// 判断 Google 连通性
function checkGoogleConnectivity() {
    var googleImg = new Image();
    var googleTimeout = setTimeout(function () {
        document.getElementById("googleStatus").innerHTML = "<span class='text-danger'>不可用</span>";
    }, 2000);
    googleImg.onload = function () {
        clearTimeout(googleTimeout);
        document.getElementById("googleStatus").innerHTML = "<span class='text-success'>可用</span>";
    };
    googleImg.src = "https://www.google.com/logos/doodles/2023/yukie-chiris-120th-birthday-6753651837110050-2x.png?" + Date.now();
}

// 判断 Baidu 连通性
function checkBaiduConnectivity() {
    var baiduImg = new Image();
    var baiduTimeout = setTimeout(function () {
        document.getElementById("baiduStatus").innerHTML = "<span class='text-danger'>不可用</span>";
    }, 2000);
    baiduImg.onload = function () {
        clearTimeout(baiduTimeout);
        document.getElementById("baiduStatus").innerHTML = "<span class='text-success'>可用</span>";
    };
    baiduImg.src = "https://www.baidu.com/img/flexible/logo/pc/peak-result.png?" + Date.now();
}

// 判断网易连通性
function checkNeteaseConnectivity() {
    var neteaseImg = new Image();
    var neteaseTimeout = setTimeout(function () {
        document.getElementById("neteaseStatus").innerHTML = "<span class='text-danger'>不可用</span>";
    }, 2000);
    neteaseImg.onload = function () {
        clearTimeout(neteaseTimeout);
        document.getElementById("neteaseStatus").innerHTML = "<span class='text-success'>可用</span>";
    };
    neteaseImg.src = "https://s2.music.126.net/style/web2/img/frame/topbar.png?a04faa1a3bfab113fbb5df069c25f682?" + Date.now();
}

// 判断 Github 连通性
function checkGithubConnectivity() {
    var githubImg = new Image();
    var githubTimeout = setTimeout(function () {
        document.getElementById("githubStatus").innerHTML = "<span class='text-danger'>不可用</span>";
    }, 2000);
    githubImg.onload = function () {
        clearTimeout(githubTimeout);
        document.getElementById("githubStatus").innerHTML = "<span class='text-success'>可用</span>";
    };
    githubImg.src = "https://raw.githubusercontent.com/jason5ng32/fulian4/master/background.jpg?" + Date.now();
}

// 判断 Youtube 连通性
function checkYoutubeConnectivity() {
    var youtubeImg = new Image();
    var youtubeTimeout = setTimeout(function () {
        document.getElementById("youtubeStatus").innerHTML = "<span class='text-danger'>不可用</span>";
    }, 2000);
    youtubeImg.onload = function () {
        clearTimeout(youtubeTimeout);
        document.getElementById("youtubeStatus").innerHTML = "<span class='text-success'>可用</span>";
    };
    youtubeImg.src = "https://i.ytimg.com/vi/GYkq9Rgoj8E/hq720.jpg?" + Date.now();
}

function getIPFromIpapi() {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            var ip = response.ip;
            ips.push(ip); // 将获取到的 IP 地址添加到数组中
            queryIpapi(ip, '国外 IP', 'table-success'); // 调用查询 ipapi.co 的函数
        }
    };
    xhr.open('GET', 'https://ipapi.co/json/', true);
    xhr.send();
}

function getIPFromTaobao() {
    var script = document.createElement('script');
    script.src = 'https://www.taobao.com/help/getip.php?callback=ipCallback';
    document.head.appendChild(script);
}

function ipCallback(data) {
    var ip = data.ip;
    ips.push(ip); // 将获取到的 IP 地址添加到数组中
    queryIpapi(ip, '国内 IP', 'table-info'); // 调用查询 ipapi.co 的函数
}

function queryIpapi(ip, tableTitle, tableClass) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            displayIpapiResult(response, tableTitle, tableClass); // 调用展示 ipapi.co 查询结果的函数
        }
    };
    xhr.open('GET', 'https://ipapi.co/' + ip + '/json/', true);
    xhr.send();
}

function displayIpapiResult(data, tableTitle, tableClass) {
    var tableContainer = document.createElement('div');
    var tableTitleElement = document.createElement('h4');
    tableTitleElement.textContent = tableTitle;
    tableContainer.appendChild(tableTitleElement);

    var table = document.createElement('table');
    table.classList.add('table', 'table-bordered', tableClass); // 添加 Bootstrap 的表格样式类名
    var headers = ['IP', '国家', '地区', '城市', '经纬度', 'ISP', 'AS号'];
    for (var i = 0; i < headers.length; i++) {
        var row = table.insertRow();
        var headerCell = row.insertCell();
        headerCell.textContent = headers[i];
        headerCell.classList.add('fixed-header-width');
        var dataCell = row.insertCell();
        switch (i) {
            case 0:
                dataCell.textContent = data.ip;
                break;
            case 1:
                var flagIcon = document.createElement('span');
                flagIcon.classList.add('flag-icon', 'flag-icon-' + data.country_code.toLowerCase());
                dataCell.appendChild(flagIcon);
                dataCell.append(' ' + data.country_name);
                break;
            case 2:
                dataCell.textContent = data.region;
                break;
            case 3:
                dataCell.textContent = data.city;
                break;
            case 4:
                dataCell.textContent = data.latitude + ', ' + data.longitude;
                break;
            case 5:
                dataCell.textContent = data.org;
                break;
            case 6:
                dataCell.textContent = data.asn;
                break;
        }
    }
    tableContainer.appendChild(table);
    document.getElementById('result').appendChild(tableContainer);

    // 判断是否需要显示提示信息
    if (ips.length === 2) {
        if (ips[0] === ips[1]) {
            document.getElementById('result').children[1].style.display = 'none';
            document.getElementById('result').children[0].children[0].textContent = '你的 IP 信息';
        }
        displayAlert(data.country_name === 'China' && ips[0] === ips[1], ips[0] !== ips[1]);
    }
}

function displayAlert(isInChina, isDifferentIP) {
    if (alertDisplayed) {  // 检查是否已经显示了警告信息
        return;
    }

    var alert = document.createElement('div');
    alert.classList.add('alert');

    if (isInChina) {
        alert.classList.add('alert-danger');
        alert.textContent = '你目前似乎没有翻墙';
    } else if (isDifferentIP) {
        alert.classList.add('alert-success');
        alert.textContent = '你目前似乎正在使用代理，且已经做了规则分流';
    } else {
        alert.classList.add('alert-success');
        alert.textContent = '你目前似乎已经翻墙';
    }

    document.body.insertBefore(alert, document.body.firstChild);

    alertDisplayed = true;  // 设置标志为 true


    // 10秒后自动淡出提示信息
    setTimeout(function () {
        alert.classList.add('fade');
        setTimeout(function () {
            alert.remove();
        }, 500);
    }, 10000);
}

function getIPs() {
    getIPFromIpapi();
    getIPFromTaobao();
    checkGoogleConnectivity();  // 在获取 IP 地址的同时检查 Google 的连通性
    checkBaiduConnectivity();  // 在获取 IP 地址的同时检查 Baidu 的连通性
    checkGithubConnectivity();  // 在获取 IP 地址的同时检查 Github 的连通性
    checkYoutubeConnectivity();  // 在获取 IP 地址的同时检查 Youtube 的连通性
    checkNeteaseConnectivity();  // 在获取 IP 地址的同时检查 Netease 的连通性
}

