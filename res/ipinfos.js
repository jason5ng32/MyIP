var ips = [null, null]; // 创建一个空数组用于存储 IP 地址 
var alertDisplayed = false;  // 添加一个新的全局变量

function checkConnectivityHandler(id, url) {
    const beginTime = + new Date();
    const element = document.getElementById(id);
    element.innerHTML = "<span class='text-info'>检查中...</span>";
    var img = new Image();
    var timeout = setTimeout(function () {
        element.innerHTML = "<span class='text-danger'>检查超时</span>";
    }, 30 * 1000);
    img.onload = function () {
        clearTimeout(timeout);
        element.innerHTML = `<span class='text-success'>可用 ( ${+ new Date() - beginTime} ms )</span>`;
    };
    img.onerror = function () {
        clearTimeout(timeout);
        element.innerHTML = "<span class='text-danger'>不可用</span>";
    };
    img.src = `${url}${Date.now()}`;
}

// 判断 Google 连通性
function checkGoogleConnectivity() {
    checkConnectivityHandler("googleStatus", "https://www.google.com/images/errors/robot.png?");
}

// 判断 Baidu 连通性
function checkBaiduConnectivity() {
    checkConnectivityHandler("baiduStatus", "https://www.baidu.com/img/flexible/logo/pc/peak-result.png?");
}

// 判断网易连通性
function checkNeteaseConnectivity() {
    checkConnectivityHandler("neteaseStatus", "https://s2.music.126.net/style/web2/img/frame/topbar.png?a04faa1a3bfab113fbb5df069c25f682&");
}

// 判断 Github 连通性
function checkGithubConnectivity() {
    checkConnectivityHandler("githubStatus", "https://raw.githubusercontent.com/jason5ng32/fulian4/master/background.jpg?");
}

// 判断 Youtube 连通性
function checkYoutubeConnectivity() {
    checkConnectivityHandler("youtubeStatus", "https://i.ytimg.com/vi/GYkq9Rgoj8E/hq720.jpg?");
}

function getIPFromIpapi() {
    document.getElementById('result_1').innerHTML = '查询中...'
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            var ip = response.ip;
            // ips.push(ip); // 将获取到的 IP 地址添加到数组中
            ips[1] = ip; // 将获取到的 IP 地址添加到数组中
            queryIpapi(1, ip, 'table-success'); // 调用查询 ipapi.co 的函数
        }
    };
    xhr.open('GET', 'https://ipapi.co/json/', true);
    xhr.send();
}

function getIPFromTaobao() {
    if(ips[0] === ips[1]){
        getIPFromIpapi()
    }
    document.getElementById('result_0').innerHTML = '查询中...'
    var script = document.createElement('script');
    script.src = 'https://www.taobao.com/help/getip.php?callback=ipCallback';
    document.head.appendChild(script);
}

function ipCallback(data) {
    var ip = data.ip;
    // ips.push(ip); // 将获取到的 IP 地址添加到数组中
    ips[0] = ip; // 将获取到的 IP 地址添加到数组中
    queryIpapi(0, ip, 'table-info'); // 调用查询 ipapi.co 的函数
}

function queryIpapi(divIndex, ip, tableClass) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            displayIpapiResult(divIndex, response, tableClass); // 调用展示 ipapi.co 查询结果的函数
        }
    };
    xhr.open('GET', 'https://ipapi.co/' + ip + '/json/', true);
    xhr.send();
}

function displayIpapiResult(divIndex, data, tableClass) {
    var tableContainer = document.createElement('div');
    var table = document.createElement('table');
    table.classList.add('table', 'table-bordered', 'shadow', tableClass); // 添加 Bootstrap 的表格样式类名
    var headers = ['IP', '国家', '地区', '城市', '经纬度', 'ISP', 'AS号'];
    for (var i = 0; i < headers.length; i++) {
        var row = table.insertRow();
        row.innerHTML = `<th class="fixed-header-width">${headers[i]}</th>`;
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
                dataCell.innerHTML = data.latitude + ', ' + data.longitude + ' ' + '<a href="https://www.google.com/maps/search/?api=1&query=' + data.latitude + ',' + data.longitude + '" target="_blank" title="Google 地图"><i class="bi bi-geo-fill"></i></a>';
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
    const resultDiv = document.getElementById(`result_${divIndex}`)
    resultDiv.innerHTML="";
    resultDiv.appendChild(tableContainer);

    // 判断是否需要显示提示信息
    if (ips.length === 2) {
        if (ips[0] === ips[1]) {
            document.getElementById('result_x').style.display = 'none';
            document.getElementById('ipTitle').textContent = '你的 IP 信息';
        } else {
            document.getElementById('result_x').style.display = 'block';
            document.getElementById('ipTitle').textContent = '国内 IP';
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

function checkConnectivity(){
    checkGoogleConnectivity();  // 在获取 IP 地址的同时检查 Google 的连通性
    checkBaiduConnectivity();  // 在获取 IP 地址的同时检查 Baidu 的连通性
    checkGithubConnectivity();  // 在获取 IP 地址的同时检查 Github 的连通性
    checkYoutubeConnectivity();  // 在获取 IP 地址的同时检查 Youtube 的连通性
    checkNeteaseConnectivity();  // 在获取 IP 地址的同时检查 Netease 的连通性
}

function getIPs() {
    getIPFromIpapi();
    getIPFromTaobao();
    checkConnectivity();
}

