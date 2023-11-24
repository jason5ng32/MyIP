
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
    $("#error-message").text("正在查询...");
    $.ajax({
        url: `https://ipapi.co/${ip}/json/`,
        success: function (data) {
            if(data.error){
                $('#error-message').text(data.reason); // 显示错误信息
            } else {
                // 清除错误信息
                $("#error-message").text("");
            }
            // 呈现数据到模态框
            const html = data.error ? '' : `
                    <table class="table">
                        <tr>
                            <th>国家</th>
                            <td>
        <span class="flag-icon flag-icon-${data.country_code.toLowerCase()}"></span>
        ${data.country_name}
    </td>
                        </tr>
                        <tr>
                            <th>地区</th>
                            <td>${data.region}</td>
                        </tr>
                        <tr>
                            <th>城市</th>
                            <td>${data.city}</td>
                        </tr>
                        <tr>
                            <th>经纬度</th>
                            <td>${data.latitude}, ${data.longitude}</td>
                        </tr>
                        <tr>
                            <th>ISP</th>
                            <td>${data.org}</td>
                        </tr>
                        <tr>
                            <th>AS号</th>
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