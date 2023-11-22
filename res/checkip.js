
// IP 地址验证正则
const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?))$/;

const isValidIP = (ip) => {
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

$(document).ready(function () {
    $("#ip-btn").click(function () {
        $("#ip-modal").modal('show');
    });
});

$('#ip-input').on('input', function () {
    const ip = $(this).val();
    if (isValidIP(ip)) {
        $('#query-btn').prop('disabled', false);
    } else {
        $('#query-btn').prop('disabled', true);
    }
});

$('#query-btn').on('click', function () {
    const ip = $('#ip-input').val();
    if (isValidIP(ip)) {
        queryIP(ip);
    } else {
        $('#error-message').text('请输入有效的 IP 地址。'); // 显示错误信息
    }
});

$('#ip-input').on('keypress', function (e) {
    if (e.which === 13) {
        const ip = $(this).val();
        if (isValidIP(ip)) {
            queryIP(ip);
        } else {
            $('#error-message').text('请输入有效的 IP 地址。'); // 显示错误信息
        }
    }
});


function queryIP(ip) {
    $.ajax({
        url: `https://ipapi.co/${ip}/json/`,
        success: function (data) {
            // 清除错误信息
            $('#error-message').text('');
            // 呈现数据到模态框
            const html = `
                    <table class="table">
                        <tr>
                            <td>国家</td>
                            <td>
        <span class="flag-icon flag-icon-${data.country_code.toLowerCase()}"></span>
        ${data.country_name}
    </td>
                        </tr>
                        <tr>
                            <td>地区</td>
                            <td>${data.region}</td>
                        </tr>
                        <tr>
                            <td>城市</td>
                            <td>${data.city}</td>
                        </tr>
                        <tr>
                            <td>经纬度</td>
                            <td>${data.latitude}, ${data.longitude}</td>
                        </tr>
                        <tr>
                            <td>ISP</td>
                            <td>${data.org}</td>
                        </tr>
                        <tr>
                            <td>AS号</td>
                            <td>${data.asn}</td>
                        </tr>
                    </table>
                `;
            $('#result-container').html(html);
        },
        error: function () {
            $('#error-message').text('查询失败，请检查输入的 IP 地址是否正确。'); // 显示错误信息
        }
    });
}